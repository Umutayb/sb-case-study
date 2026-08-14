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
    //
    // The two panels are asserted because they render on every dashboard
    // variant. An earlier version also checked a "Your trial ends in …"
    // banner, which is only present on one variant — a freshly-provisioned
    // account gets a newer dashboard (the `new-nav` experiment) with a
    // "Confirm plan" control instead, so that assertion failed on new
    // accounts. The panels are the variant-stable signal.
    await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_LOGIN, undefined, { timeout: 30000 });
    await steps.verifyPresence('mySchedulePanel', 'DashboardPage');
    await steps.verifyPresence('myTimesheetsPanel', 'DashboardPage');
  });

  test('the dashboard exposes the primary navigation', async ({ steps }) => {
    const { email, password } = readAccount();

    await logInToDashboard(steps, email, password);

    // `homeNavLink` matches "Home" or "Dashboard": the landing nav item is
    // labelled differently across dashboard variants. The other four are
    // stable across both.
    await steps.verifyAllPresent([
      { elementName: 'homeNavLink', pageName: 'DashboardPage' },
      { elementName: 'scheduleNavLink', pageName: 'DashboardPage' },
      { elementName: 'timesheetNavLink', pageName: 'DashboardPage' },
      { elementName: 'employeesNavLink', pageName: 'DashboardPage' },
      { elementName: 'reportsNavLink', pageName: 'DashboardPage' },
    ]);
  });
});
