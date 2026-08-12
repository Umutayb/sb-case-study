import { test } from './fixtures/base';
import { UrlPattern } from './fixtures/test-data';
import { readAccount } from './fixtures/auth';
import { submitLogin, dismissMfaPrompt, logInToDashboard } from './flows/login-flow';

test.describe('Login', () => {
  test('valid credentials reach the dashboard', async ({ steps }) => {
    const { email, password } = readAccount();

    await logInToDashboard(steps, email, password);

    await steps.verifyPresence('mySchedulePanel', 'DashboardPage');
    await steps.verifyPresence('myTimesheetsPanel', 'DashboardPage');
  });

  test('login is offered multifactor authentication before the dashboard', async ({ steps }) => {
    const { email, password } = readAccount();

    await submitLogin(steps, email, password);

    // Asserted as part of the journey rather than clicked through silently:
    // if this screen disappeared, the login flow would have changed shape.
    await steps.waitForUrl(UrlPattern.MFA_PROMOTE, undefined, { timeout: 30000 });
    await steps.verifyPresence('setUpNowButton', 'MfaPromotePage');
    await steps.verifyPresence('remindMeLaterButton', 'MfaPromotePage');
    await steps.verifyPresence('dontAskAgainButton', 'MfaPromotePage');

    await dismissMfaPrompt(steps);
    await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_LOGIN, undefined, { timeout: 30000 });
  });
});
