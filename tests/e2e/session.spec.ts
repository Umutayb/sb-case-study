import { test } from './fixtures/base';
import { UrlPattern } from './fixtures/test-data';
import { readAccount } from './fixtures/auth';
import { logInToDashboard } from './flows/login-flow';

test.describe('Session', () => {
  test('an authenticated session survives a reload', async ({ steps }) => {
    const { email, password } = readAccount();

    await logInToDashboard(steps, email, password);

    await steps.refresh();

    // The point of the test: a reload must not bounce the user back to
    // /login. Asserting the dashboard is still rendered — not merely that the
    // URL is unchanged — because the app could hold the route while having
    // dropped the session.
    await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_LOGIN, undefined, { timeout: 30000 });
    await steps.verifyPresence('mySchedulePanel', 'DashboardPage');
    await steps.verifyPresence('trialBanner', 'DashboardPage');
  });

  test('the dashboard exposes the primary navigation', async ({ steps }) => {
    const { email, password } = readAccount();

    await logInToDashboard(steps, email, password);

    await steps.verifyAllPresent([
      { elementName: 'homeNavLink', pageName: 'DashboardPage' },
      { elementName: 'scheduleNavLink', pageName: 'DashboardPage' },
      { elementName: 'timesheetNavLink', pageName: 'DashboardPage' },
      { elementName: 'employeesNavLink', pageName: 'DashboardPage' },
      { elementName: 'reportsNavLink', pageName: 'DashboardPage' },
    ]);
  });
});
