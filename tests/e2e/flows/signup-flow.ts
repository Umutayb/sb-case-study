import type { Steps } from '@civitas-cerebrum/element-interactions';
import { Routes, UrlPattern, type TestUser } from '../fixtures/test-data';

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
 * Selects an answer, then advances.
 *
 * The label click is occasionally lost: the questionnaire re-renders each step
 * as it validates, and a click landing during that swap never reaches the
 * input, leaving `Next` disabled until the test times out. Observed as an
 * intermittent 30s failure on the full signup run.
 *
 * Rather than retrying the whole test, the selection is re-asserted once if it
 * did not take. If the answer registered the first time — the normal case —
 * this costs one attribute read.
 */
async function selectAnswerAndAdvance(steps: Steps, option: string): Promise<void> {
  await steps.click(option, QUIZ);

  if (!(await nextBecomesEnabled(steps))) {
    await steps.click(option, QUIZ);
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
  // Step 1 — business details.
  await steps.verifyPresence('businessName', QUIZ);
  await steps.fill('businessName', QUIZ, user.businessName);
  await steps.fill('numberOfEmployees', QUIZ, user.employeeCount);
  await clickNextWhenEnabled(steps);

  // Step 2 — business type reveals industry, which reveals role. Subject to
  // the same re-render race documented on selectAnswerAndAdvance below: any
  // of the three reveals can have its click land mid re-render and get lost,
  // leaving Next disabled. Re-assert all three once before giving up.
  await steps.click('businessTypeOption', QUIZ);
  await steps.click('industryOption', QUIZ);
  await steps.click('buyerRoleOption', QUIZ);
  if (!(await nextBecomesEnabled(steps))) {
    await steps.click('businessTypeOption', QUIZ);
    await steps.click('industryOption', QUIZ);
    await steps.click('buyerRoleOption', QUIZ);
  }
  await clickNextWhenEnabled(steps);

  // Step 3 — needs (multi-select).
  await steps.click('needSchedulingOption', QUIZ);
  await steps.click('needTimeTrackingOption', QUIZ);
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

  await steps.waitForUrl(UrlPattern.ONBOARDING, undefined, { timeout: 30000 });
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
