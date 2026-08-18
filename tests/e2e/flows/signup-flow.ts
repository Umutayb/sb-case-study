import type { Steps } from '@civitas-cerebrum/element-interactions';
import { Routes, UrlPattern, type TestUser } from '../data/test-data';

const SIGNUP = 'SignupPage';
const QUIZ = 'SignupQuestionnairePage';
const ONBOARDING = 'OnboardingPage';

/**
 * Fills and submits the registration form. Leaves the browser on the first
 * questionnaire step on success, or on the registration step (with inline
 * validation visible) when the form is invalid.
 *
 * `acceptTerms` defaults to `true` so every existing call site keeps
 * submitting a fully valid form; validation specs pass `false` to exercise
 * the unticked-terms rejection without duplicating the fill sequence.
 */
export async function submitRegistrationForm(
  steps: Steps,
  user: TestUser,
  options: { acceptTerms?: boolean } = {},
): Promise<void> {
  await steps.navigateTo(Routes.SIGNUP, { waitUntil: 'domcontentloaded' });

  await steps.fill('firstName', SIGNUP, user.firstName);
  await steps.fill('lastName', SIGNUP, user.lastName);
  await steps.fill('email', SIGNUP, user.email);
  await steps.fill('mobileNumber', SIGNUP, user.mobileNumber);
  await steps.fill('password', SIGNUP, user.password);
  if (options.acceptTerms ?? true) {
    await steps.check('termsCheckbox', SIGNUP);
  }

  await steps.click('getStartedButton', SIGNUP);
}

/**
 * Advances one questionnaire step.
 *
 * The step's `Next` button is enabled asynchronously once Angular revalidates
 * the form, so clicking straight after the last answer races the framework.
 * Waiting for the enabled state is what makes this flow deterministic instead
 * of retry-dependent.
 */
async function clickNextWhenEnabled(steps: Steps): Promise<void> {
  await steps.verifyState('nextButton', QUIZ, 'enabled');
  await steps.click('nextButton', QUIZ);
}

/** Polls the step's `Next` button, resolving false if it stays disabled. */
async function nextBecomesEnabled(steps: Steps, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await steps.getAttribute('nextButton', QUIZ, 'disabled')) === null) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/**
 * Fills a questionnaire field and confirms the value actually stuck.
 *
 * `fill` can be lost to the same step re-render that drops label clicks: the
 * input is re-created between the fill and its commit, and the value never
 * lands. A single verify surfaces that as a clean failure, but the fix is to
 * re-fill — so this re-fills in a bounded loop until the field holds the value,
 * then leaves the final assertion to the caller / the last read here.
 */
async function fillUntilValue(steps: Steps, element: string, value: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await steps.fill(element, QUIZ, value);
    if ((await steps.getInputValue(element, QUIZ)) === value) return;
  }
  // Final gate: throws with a clear value-mismatch if every attempt was lost.
  await steps.verifyInputValue(element, QUIZ, value);
}

/**
 * Selects a single-select answer, then advances.
 *
 * The label click is occasionally lost: the questionnaire re-renders each step
 * as it validates, and a click landing during that swap never reaches the
 * input, leaving `Next` disabled. A single re-click closed most of that, but
 * not all — under heavy re-render both the first click and a lone retry can be
 * swallowed, and the step then times out at 30s.
 *
 * So the option is clicked in a bounded loop until `Next` actually enables.
 * These are radio options, so re-clicking a selection that already landed is
 * idempotent — no risk of toggling it off. In the normal case the first click
 * takes and the loop exits after one cheap attribute poll. `clickNextWhenEnabled`
 * is the final gate: if every attempt was somehow lost it throws with a clear
 * enabled-state failure rather than a mystery timeout.
 */
async function selectAnswerAndAdvance(steps: Steps, option: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await steps.click(option, QUIZ);
    if (await nextBecomesEnabled(steps)) break;
  }

  await clickNextWhenEnabled(steps);
}

/**
 * Walks the profiling questionnaire that follows registration.
 *
 * Each step gates its `Next` button until the required inputs are set, and
 * the business-type step reveals two further questions as it is answered, so
 * the order below is load-bearing rather than cosmetic.
 */
export async function completeQuestionnaire(steps: Steps, user: TestUser): Promise<void> {
  // Step 1 — business details. Both fills are re-applied until they stick (a
  // fill can be lost to the step re-render just like a label click), so a
  // dropped value becomes a re-fill rather than a 30s mystery timeout.
  await steps.verifyPresence('businessName', QUIZ);
  await fillUntilValue(steps, 'businessName', user.businessName);
  await fillUntilValue(steps, 'numberOfEmployees', user.employeeCount);
  await clickNextWhenEnabled(steps);

  // Step 2 — business type reveals industry, which reveals role. Subject to
  // the same re-render race as selectAnswerAndAdvance below: any of the three
  // reveals can have its click land mid re-render and get lost, leaving Next
  // disabled. Re-assert the whole chain in a bounded loop until Next enables —
  // re-clicking radios that already landed is idempotent, so repeating the
  // chain only fills in whichever click was dropped.
  for (let attempt = 0; attempt < 4; attempt++) {
    await steps.click('businessTypeOption', QUIZ);
    await steps.click('industryOption', QUIZ);
    await steps.click('buyerRoleOption', QUIZ);
    if (await nextBecomesEnabled(steps)) break;
  }
  await clickNextWhenEnabled(steps);

  // Step 3 — needs (multi-select). Same lost-click race, but the retry has to
  // be state-aware: these are checkboxes, so re-clicking a box that already
  // landed would UNCHECK it. `Next` only needs one selection, so the loop
  // re-clicks a single option and only while nothing at all is checked —
  // never toggling off a selection that did register.
  await steps.click('needSchedulingOption', QUIZ);
  await steps.click('needTimeTrackingOption', QUIZ);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await nextBecomesEnabled(steps)) break;
    if ((await steps.getCount('needsCheckedOption', QUIZ)) === 0) {
      await steps.click('needSchedulingOption', QUIZ);
    }
  }
  await clickNextWhenEnabled(steps);

  // Steps 4-8 — one single-select answer each.
  for (const option of [
    'situationOption',
    'painOption',
    'impactOption',
    'criticalEventOption',
    'urgencyOption',
  ]) {
    await selectAnswerAndAdvance(steps, option);
  }

  // The last step's Next is not a client-side route change — it fires the
  // account-creating POST /api/signup, the single heaviest call in the flow,
  // and the redirect to /onboarding only happens once the backend responds.
  // A 30s budget was occasionally too tight for that round-trip on this shared
  // demo environment, which intermittently returns gateway errors (502/504)
  // under load. A true gateway failure is left to Playwright's configured
  // retries; this wider budget only covers a slow-but-successful submission,
  // without masking a genuine failure.
  await steps.waitForUrl(UrlPattern.ONBOARDING, undefined, { timeout: 60000 });
}

/**
 * Walks the post-registration setup wizard through to the dashboard.
 *
 * The number of steps is treated as variable on purpose — this wizard is the
 * part of the product most likely to gain or lose a screen, and hardcoding a
 * count would make the spec fail for a reason that has nothing to do with the
 * behaviour under test.
 */
export async function completeOnboardingWizard(steps: Steps): Promise<void> {
  for (let step = 0; step < 8; step++) {
    if ((await steps.getCount('seeInActionButton', ONBOARDING)) > 0) break;

    const advanced =
      (await steps.clickIfPresent('nextButton', ONBOARDING)) ||
      (await steps.clickIfPresent('skipButton', ONBOARDING));

    if (!advanced) break;
  }

  await steps.verifyPresence('allSetHeading', ONBOARDING);
  await steps.click('seeInActionButton', ONBOARDING);
}

/**
 * A brand-new account lands on the dashboard behind a first-run dialog
 * ("Welcome to Shiftbase"), which covers the dashboard content. Dismissing it
 * is the last act of the signup journey rather than the first act of using
 * the product, so it lives here — but it is optional, because which first-run
 * modal appears varies between runs.
 */
export async function dismissFirstRunDialog(steps: Steps): Promise<void> {
  const dismissed = await steps.clickIfPresent('firstRunDialogClose', 'DashboardPage');

  // Without this, a close button that stops matching a modal variant would
  // no-op silently: the dialog stays open, and the dashboard assertions still
  // pass because Playwright's visibility check ignores elements stacked on
  // top. The dismissal has to prove it worked.
  if (dismissed) {
    await steps.verifyAbsence('firstRunDialog', 'DashboardPage');
  }
}

/** Registration through to the dashboard, as one call. */
export async function signUpToDashboard(steps: Steps, user: TestUser): Promise<void> {
  await submitRegistrationForm(steps, user);
  await completeQuestionnaire(steps, user);
  await completeOnboardingWizard(steps);
  await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_SIGNUP, undefined, { timeout: 45000 });
}
