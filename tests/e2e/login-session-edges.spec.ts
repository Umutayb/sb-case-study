import { ElementRepository } from '@civitas-cerebrum/element-repository';
import { Steps } from '@civitas-cerebrum/element-interactions';
import { test } from './fixtures/base';
import { Routes, UrlPattern, buildUser, type TestUser } from './fixtures/test-data';
import { readAccount } from './fixtures/auth';
import { submitLogin, logInToDashboard, logOut } from './flows/login-flow';
import { signUpToDashboard } from './flows/signup-flow';

const LOGIN = 'LoginPage';
const MFA = 'MfaPromotePage';
const DASHBOARD = 'DashboardPage';

/**
 * Mints a fresh account (full signup + questionnaire + onboarding skip) and
 * ends its landing session, leaving the browser on `/login` with known-good
 * credentials ready for a deliberate re-login.
 *
 * Used only by the tests in this file that log a session out from under
 * itself. The suite runs `fullyParallel` and every other spec shares one
 * account via `readAccount()` — reusing it here would risk tearing down a
 * sibling spec's in-flight session for a behaviour (session termination)
 * this file exists to exercise on purpose.
 */
async function mintAccountAndLogOut(steps: Steps): Promise<TestUser> {
  const user = buildUser();
  await signUpToDashboard(steps, user);
  await logOut(steps);
  return user;
}

test.describe('Login — session and MFA-branch edges', () => {
  // Three of these tests mint a dedicated account via the signup flow and
  // deliberately end a session (see each test's comment for why). Serial
  // mode keeps those signup POSTs and logouts from racing each other within
  // this file — see the test-composer rule on file-level serial mode for
  // tenant-mutating specs.
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

  /**
   * Discovery finding: "Back to login" on `/login/mfa-promote` reads like a
   * passive back-link but is actually a logout in disguise — confirmed live
   * by clicking it and then attempting a direct dashboard visit, which
   * bounced to `/login` exactly as it would for a fully logged-out visitor.
   * That is surprising enough to pin down as a named regression test rather
   * than leave as an anecdote in the journey map.
   */
  test('"Back to login" on the MFA prompt silently terminates the session', async ({ steps }) => {
    test.setTimeout(180_000);

    const user = await mintAccountAndLogOut(steps);

    // A fresh account has never dismissed the MFA prompt before, so this
    // second login is guaranteed to show it — the interstitial is mandatory
    // on every login, not merely the first one.
    await submitLogin(steps, user.email, user.password);
    await steps.waitForUrl(UrlPattern.MFA_PROMOTE, undefined, { timeout: 30000 });
    await steps.verifyPresence('backToLoginButton', MFA);

    await steps.click('backToLoginButton', MFA);

    // Symptom 1: it lands on /login, same as any logout.
    await steps.waitForUrl(UrlPattern.LOGIN, undefined, { timeout: 20000 });
    await steps.verifyPresence('heading', LOGIN);

    // Symptom 2 — the one that proves this is a real logout and not just a
    // route change that happens to look like one: a subsequent direct nav to
    // the dashboard bounces straight back to /login, exactly as it would for
    // a visitor who was never authenticated at all.
    await steps.navigateTo(Routes.DASHBOARD, { waitUntil: 'domcontentloaded' });
    await steps.waitForUrl(UrlPattern.LOGIN, undefined, { timeout: 20000 });
    await steps.verifyPresence('heading', LOGIN);
  });

  /**
   * Runs only in the `mobile` project. Mirrors `signup.spec.ts`'s mobile
   * pattern: fill the form and confirm it is usable at a narrow width,
   * without submitting — the desktop specs already cover login's functional
   * behaviour, so re-walking it here would just double the runtime for no
   * new evidence. Safe to use the shared account since nothing is submitted.
   */
  test('the login form is usable on a mobile viewport @mobile', async ({ steps }) => {
    const { email, password } = readAccount();

    await steps.navigateTo(Routes.LOGIN, { waitUntil: 'domcontentloaded' });

    await steps.verifyPresence('heading', LOGIN);
    await steps.fill('email', LOGIN, email);
    await steps.fill('password', LOGIN, password);
    await steps.verifyInputValue('email', LOGIN, email);
    await steps.verifyInputValue('password', LOGIN, password);

    await steps.check('keepLoggedInCheckbox', LOGIN);
    await steps.verifyState('keepLoggedInCheckbox', LOGIN, 'checked');

    await steps.verifyState('loginButton', LOGIN, 'visible');
    await steps.verifyState('loginButton', LOGIN, 'enabled');
    await steps.verifyPresence('forgotPasswordLink', LOGIN);
  });

  /**
   * Confirmed live across two isolated browser contexts: the same account
   * can hold two concurrent authenticated sessions, and ending one does not
   * touch the other. A single `steps`/`page` can only ever hold one session
   * cookie, so proving "concurrent" at all requires a second, independently
   * constructed `Steps` instance bound to its own browser context — built
   * directly from the exported `ElementRepository`/`Steps` classes against
   * the same page-repository.json, not a raw Playwright locator escape
   * hatch.
   *
   * Uses a dedicated account (this test's whole point is exercising logout
   * across sessions) rather than the shared one other spec files log into
   * concurrently.
   */
  test('logging out of one session does not affect a concurrent session for the same account', async ({
    steps,
    browser,
  }) => {
    test.setTimeout(180_000);

    const user = await mintAccountAndLogOut(steps);

    // Session A — the fixture's own context.
    await logInToDashboard(steps, user.email, user.password);
    await steps.verifyPresence('mySchedulePanel', DASHBOARD);

    // Session B — a second, independently authenticated browser context for
    // the same account.
    const contextB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageB = await contextB.newPage();
    const repoB = new ElementRepository(pageB, 'tests/e2e/page-repository.json', 30000);
    const stepsB = new Steps(repoB, { timeout: 30000 });

    try {
      await logInToDashboard(stepsB, user.email, user.password);
      await stepsB.verifyPresence('mySchedulePanel', DASHBOARD);

      // End session A only.
      await logOut(steps);

      // Session B must still be authenticated on a fresh load — not merely
      // still showing a render cached from before session A ended.
      await stepsB.refresh();
      await stepsB.waitForUrl(UrlPattern.DASHBOARD_AFTER_LOGIN, undefined, { timeout: 30000 });
      await stepsB.verifyPresence('mySchedulePanel', DASHBOARD);
    } finally {
      await contextB.close();
    }
  });

  /**
   * Confirmed live: clearing every cookie on an authenticated dashboard
   * (`context.clearCookies()` — the app's session has no readable
   * localStorage/sessionStorage token, only cookies, so this is the genuine
   * equivalent of "the session cookie disappeared") and then triggering an
   * action that actually calls the API (as opposed to a passive client-side
   * route change, which this app can serve from cached state without
   * noticing the cookie is gone) redirects cleanly to `/login` with a fully
   * rendered form — not a hang, not a blank shell.
   *
   * Uses a dedicated account: the app's own interceptor ends the session as
   * part of this redirect, which is exactly the kind of session-destroying
   * action this file keeps off the shared account.
   */
  test('a session invalidated mid-interaction redirects to login instead of hanging or blanking', async ({
    steps,
    context,
  }) => {
    test.setTimeout(180_000);

    const user = await mintAccountAndLogOut(steps);
    await logInToDashboard(steps, user.email, user.password);
    await steps.verifyPresence('mySchedulePanel', DASHBOARD);

    const hasWorkedHoursCta = await steps.isPresent('addWorkedHoursButton', DASHBOARD);
    test.skip(
      !hasWorkedHoursCta,
      'no "Add Worked Hours" CTA present on this account state — nothing to trigger the API call with',
    );

    // Simulate the stale session without reloading — the SPA stays exactly
    // as rendered while the cookie disappears out from under it.
    await context.clearCookies();

    // A plain client-side nav (e.g. clicking a sidebar link) does not trip
    // this — it renders from state the app already holds. An action that
    // genuinely calls the API is what surfaces the invalid session.
    await steps.click('addWorkedHoursButton', DASHBOARD);

    await steps.waitForUrl(UrlPattern.LOGIN, undefined, { timeout: 20000 });
    await steps.verifyPresence('heading', LOGIN);
    await steps.verifyPresence('email', LOGIN);
  });
});
