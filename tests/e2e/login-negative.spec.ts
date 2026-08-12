import { test, expect } from './fixtures/base';
import { Routes, UrlPattern, uniqueEmail } from './fixtures/test-data';
import { readAccount } from './fixtures/auth';
import { submitLogin } from './flows/login-flow';

const LOGIN = 'LoginPage';

test.describe('Login — rejected attempts', () => {
  test('submitting an empty form reports both required fields', async ({ steps }) => {
    await steps.navigateTo(Routes.LOGIN, { waitUntil: 'domcontentloaded' });
    await steps.click('loginButton', LOGIN);

    await steps.verifyPresence('emailRequiredError', LOGIN);
    await steps.verifyPresence('passwordRequiredError', LOGIN);
    await steps.verifyState('email', LOGIN, 'visible');

    // Still on the login page — an empty submit must not navigate.
    await steps.verifyUrlContains('/login');
  });

  test('a wrong password is rejected', async ({ steps }) => {
    const { email } = readAccount();

    await submitLogin(steps, email, 'definitely-not-the-password');

    await steps.verifyPresence('errorAlert', LOGIN);
    await steps.verifyTextContains(
      'errorAlert',
      LOGIN,
      'Unable to log you in with the supplied credentials',
    );
    await steps.verifyUrlContains('/login');
  });

  test('an unknown email is rejected', async ({ steps }) => {
    await submitLogin(steps, uniqueEmail(), 'definitely-not-the-password');

    await steps.verifyPresence('errorAlert', LOGIN);
    await steps.verifyUrlContains('/login');
  });

  /**
   * The security property worth locking in: the message for a wrong password
   * and the message for an account that does not exist must be identical, or
   * the login form becomes an account-enumeration oracle. This asserts the
   * two are the same string rather than asserting each one separately.
   */
  test('rejection does not reveal whether the account exists', async ({ steps }) => {
    const { email } = readAccount();

    await submitLogin(steps, email, 'definitely-not-the-password');
    await steps.verifyPresence('errorAlert', LOGIN);
    const messageForRealAccount = await steps.getText('errorAlert', LOGIN);

    await submitLogin(steps, uniqueEmail(), 'definitely-not-the-password');
    await steps.verifyPresence('errorAlert', LOGIN);
    const messageForUnknownAccount = await steps.getText('errorAlert', LOGIN);

    expect(messageForUnknownAccount?.trim()).toBe(messageForRealAccount?.trim());
    expect(messageForRealAccount?.trim()).toBeTruthy();
  });

  test('a logged-out visitor cannot reach the dashboard directly', async ({ steps }) => {
    await steps.navigateTo('/dashboard/my-overview', { waitUntil: 'domcontentloaded' });

    await steps.waitForUrl(UrlPattern.LOGIN, undefined, { timeout: 20000 });
    await steps.verifyPresence('heading', LOGIN);
  });
});
