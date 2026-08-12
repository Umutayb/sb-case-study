import { test } from './fixtures/base';
import { buildUser, UrlPattern } from './fixtures/test-data';
import {
  submitRegistrationForm,
  completeQuestionnaire,
  completeOnboardingWizard,
  dismissFirstRunDialog,
} from './flows/signup-flow';

test.describe('Signup and onboarding', () => {
  test.describe.configure({ mode: 'serial' });

  test('a new trial account reaches the dashboard', async ({ steps }) => {
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

  test('the registration form hands off to the questionnaire', async ({ steps }) => {
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
