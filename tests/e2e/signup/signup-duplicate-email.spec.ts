import { test } from '../fixtures/base';
import { buildUser, UrlPattern } from '../data/test-data';
import { readAccount } from '../fixtures/auth';
import { submitRegistrationForm } from '../flows/signup-flow';
import { submitLogin } from '../flows/login-flow';

/**
 * DEFECT — signup does not enforce email uniqueness, and fails silently.
 *
 * These two tests FAIL on purpose. They describe how the product should
 * behave; the product does not behave that way today, so the suite reports
 * it. See the "A defect found while building this" section of the README.
 *
 * Reproduced on the demo environment on 2026-08-12:
 *
 *   1. Register with an email that already has an account. The form accepts
 *      it. No "email already in use" error appears, on the form or later.
 *   2. The flow proceeds into the questionnaire and setup wizard exactly as
 *      a real registration would, and reaches the dashboard.
 *   3. The password chosen during that second registration is then rejected
 *      at login.
 *   4. The original account's password still works.
 *
 * User impact: someone who forgets they already have an account re-registers,
 * chooses a new password, completes the entire onboarding, and is then locked
 * out — with nothing at any point explaining why.
 *
 * They are tagged `@known-defect` so they can be excluded from a run:
 *   npx playwright test --grep-invert @known-defect
 *
 * They are not weakened to assert the buggy behaviour. A suite that rewrites
 * itself to match a bug can no longer detect it.
 */
test.describe('Signup — duplicate email (known defect) @known-defect', () => {
  test('SGN-10 · registering an already-used email surfaces a conflict message', async ({ steps }) => {
    test.setTimeout(120_000);
    const existing = readAccount();
    const user = buildUser({ email: existing.email });

    await submitRegistrationForm(steps, user);

    // Expected: the app tells the user the address is already registered.
    // Actual: nothing is said and the questionnaire opens instead.
    //
    // Asserted as "the message should be present" rather than "the
    // questionnaire should be absent": an absence check passes vacuously in
    // the moment before the questionnaire renders, which would make this test
    // pass while the defect is live.
    await steps.verifyPageContainsText(/already (registered|in use|exists)|email.*taken/i);
  });

  test('SGN-11 · a password set during a duplicate registration works at login', async ({ steps }) => {
    test.setTimeout(120_000);
    const existing = readAccount();
    const user = buildUser({ email: existing.email });

    await submitRegistrationForm(steps, user);
    await submitLogin(steps, user.email, user.password);

    // Expected: credentials the signup form accepted are usable. Either the
    // registration should have been refused outright (covered above), or this
    // password should work. Accepting it and then rejecting it is the defect.
    // Actual: the login error alert appears instead.
    await steps.waitForUrl(UrlPattern.MFA_PROMOTE, undefined, { timeout: 20000 });
  });
});
