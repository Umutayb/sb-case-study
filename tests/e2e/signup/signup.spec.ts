import { test } from '../fixtures/base';
import { buildUser, Routes, UrlPattern } from '../data/test-data';
import {
  submitRegistrationForm,
  completeQuestionnaire,
  completeOnboardingWizard,
  dismissFirstRunDialog,
} from '../flows/signup-flow';

test.describe('Signup and onboarding', () => {
  test.describe.configure({ mode: 'serial' });

  test('SGN-01 · a new trial account reaches the dashboard', async ({ steps }) => {
    test.setTimeout(180_000);
    const user = buildUser();

    await submitRegistrationForm(steps, user);
    await completeQuestionnaire(steps, user);
    await completeOnboardingWizard(steps);

    await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_SIGNUP, undefined, { timeout: 45000 });

    // A new account arrives behind a first-run dialog; the dashboard itself is
    // only assertable once it is dismissed.
    await steps.verifyPresence('firstRunDialog', 'DashboardPage');
    await dismissFirstRunDialog(steps);

    await steps.verifyPresence('mySchedulePanel', 'DashboardPage');
    await steps.verifyPresence('scheduleNavLink', 'DashboardPage');
  });

  /**
   * Runs only in the `mobile` project. The registration form is the surface
   * most likely to break under a narrow viewport, and it is cheap to check —
   * walking the entire eight-step questionnaire on a second device profile
   * would double the suite's runtime to re-prove logic the desktop run
   * already covers.
   */
  test('SGN-02 · the registration form is usable on a mobile viewport @mobile', async ({ steps }) => {
    const user = buildUser();

    await steps.navigateTo(Routes.SIGNUP, { waitUntil: 'domcontentloaded' });

    await steps.verifyPresence('heading', 'SignupPage');
    await steps.fill('firstName', 'SignupPage', user.firstName);
    await steps.fill('email', 'SignupPage', user.email);
    await steps.verifyInputValue('email', 'SignupPage', user.email);

    await steps.verifyState('getStartedButton', 'SignupPage', 'visible');
    await steps.verifyPresence('loginLink', 'SignupPage');
  });

  test('SGN-03 · the registration form hands off to the questionnaire', async ({ steps }) => {
    test.setTimeout(120_000);
    const user = buildUser();

    await submitRegistrationForm(steps, user);

    // The URL stays /signup across the questionnaire, so the handoff is only
    // observable through the content that replaces the registration form.
    await steps.verifyPresence('businessName', 'SignupQuestionnairePage');
    await steps.verifyPresence('progressBar', 'SignupQuestionnairePage');
    await steps.verifyUrlContains('/signup');
  });
});
