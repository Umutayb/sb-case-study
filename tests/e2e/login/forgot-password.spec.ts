import { test, expect } from '../fixtures/base';
import { Routes } from '../data/test-data';
import { readAccount } from '../fixtures/auth';

const FORGOT = 'ForgotPasswordPage';

test.describe('Forgot password', () => {
  test.beforeEach(async ({ steps }) => {
    await steps.navigateTo(Routes.FORGOT_PASSWORD, { waitUntil: 'domcontentloaded' });
    await steps.verifyPresence('heading', FORGOT);
  });

  test('FPW-01 · requesting a reset for a valid email shows a confirmation', async ({ steps }) => {
    const { email } = readAccount();

    await steps.fill('email', FORGOT, email);
    await steps.click('sendResetLinkButton', FORGOT);

    await steps.verifyPresence('confirmationHeading', FORGOT);
    await steps.verifyPresence('confirmationMessage', FORGOT);

    // Still on the same URL — the confirmation is an in-place swap, not a redirect.
    await steps.verifyUrlContains('/login/forgot');
  });

  test('FPW-02 · submitting the form empty reports email is required', async ({ steps }) => {
    await steps.click('sendResetLinkButton', FORGOT);

    await steps.verifyPresence('emailRequiredError', FORGOT);

    // The form must not advance — no confirmation, still on forgot-password.
    await steps.verifyUrlContains('/login/forgot');
    await steps.verifyPresence('sendResetLinkButton', FORGOT);
  });

  test('FPW-03 · an invalid email format is rejected', async ({ steps }) => {
    await steps.fill('email', FORGOT, 'not-an-email');
    await steps.click('sendResetLinkButton', FORGOT);

    await steps.verifyPresence('emailInvalidError', FORGOT);

    // Still on the form — no confirmation rendered.
    await steps.verifyUrlContains('/login/forgot');
    await steps.verifyPresence('sendResetLinkButton', FORGOT);
  });

  /**
   * The same security property as LGN-06: the response for a known email and
   * an unknown email must be indistinguishable, or the form becomes an
   * account-enumeration oracle. This test submits both and asserts the
   * confirmation is identical.
   */
  test('FPW-04 · the response does not reveal whether the account exists', async ({ steps }) => {
    const { email } = readAccount();

    // Submit with the known account email.
    await steps.fill('email', FORGOT, email);
    await steps.click('sendResetLinkButton', FORGOT);
    await steps.verifyPresence('confirmationHeading', FORGOT);
    const headingForKnown = await steps.getText('confirmationHeading', FORGOT);

    // Reload and submit with an address that definitely has no account.
    await steps.navigateTo(Routes.FORGOT_PASSWORD, { waitUntil: 'domcontentloaded' });
    await steps.verifyPresence('heading', FORGOT);
    await steps.fill('email', FORGOT, 'certainly-no-account-here@example.com');
    await steps.click('sendResetLinkButton', FORGOT);
    await steps.verifyPresence('confirmationHeading', FORGOT);
    const headingForUnknown = await steps.getText('confirmationHeading', FORGOT);

    expect(headingForUnknown?.trim()).toBe(headingForKnown?.trim());
    expect(headingForKnown?.trim()).toBeTruthy();
  });

  test('FPW-05 · "Back to login" returns to the login page', async ({ steps }) => {
    await steps.click('backToLoginLink', FORGOT);

    await steps.verifyUrlContains('/login');
    await steps.verifyPresence('heading', 'LoginPage');
  });
});
