import type { Steps } from '@civitas-cerebrum/element-interactions';
import { Routes, UrlPattern } from '../fixtures/test-data';

const LOGIN = 'LoginPage';
const MFA = 'MfaPromotePage';

export async function submitLogin(
  steps: Steps,
  email: string,
  password: string,
): Promise<void> {
  await steps.navigateTo(Routes.LOGIN, { waitUntil: 'domcontentloaded' });
  await steps.fill('email', LOGIN, email);
  await steps.fill('password', LOGIN, password);
  await steps.click('loginButton', LOGIN);
}

/**
 * A successful login lands on an MFA promotion screen rather than the
 * dashboard. It is a prompt, not a requirement, so the flow declines it and
 * continues — but the screen is asserted rather than skipped past blindly,
 * because its disappearance would be a real change in the login journey.
 */
export async function dismissMfaPrompt(steps: Steps): Promise<void> {
  await steps.waitForUrl(UrlPattern.MFA_PROMOTE, undefined, { timeout: 30000 });
  await steps.verifyPresence('heading', MFA);
  await steps.click('remindMeLaterButton', MFA);
}

export async function logInToDashboard(
  steps: Steps,
  email: string,
  password: string,
): Promise<void> {
  await submitLogin(steps, email, password);
  await dismissMfaPrompt(steps);
  await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_LOGIN, undefined, { timeout: 30000 });
}
