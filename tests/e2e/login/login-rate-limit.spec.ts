import { test, expect } from '../fixtures/base';
import { buildUser } from '../data/test-data';
import { submitLogin } from '../flows/login-flow';
import { signUpToDashboard } from '../flows/signup-flow';
import { logOut } from '../flows/login-flow';

const LOGIN = 'LoginPage';

/**
 * DEFECT — `POST /api/auth/login` applies no rate limiting or lockout.
 *
 * This test FAILS on purpose. See the README's findings section.
 *
 * Repeated failed authentication against a single account draws no throttle,
 * no lockout, and no CAPTCHA: every attempt returns the same credentials
 * error at the same speed. Notably the sibling forgot-password endpoint on
 * the same app *does* rate-limit (it returns 429), so this is an
 * inconsistency within the product rather than a platform-wide absence.
 *
 * The test asserts the behaviour the endpoint is expected to have — that a
 * run of consecutive failures eventually produces *some* defensive response
 * (a lockout message, a challenge, or a throttled/429 outcome). Today none
 * appears, so it fails; it turns green if brute-force protection is added.
 *
 * Two deliberate constraints, because this runs against a shared demo
 * environment that is not ours:
 *
 *  - It uses a **throwaway account minted by this test**, never the shared
 *    `.env` account. If a lockout *were* implemented, the test would trip it
 *    on a disposable account rather than locking out the credentials every
 *    other spec depends on.
 *  - The attempt count is deliberately modest. It is enough to establish
 *    that no protection engages at a threshold a real attacker would clear
 *    trivially — it is not a brute-force run, and it should not be raised.
 */
const FAILED_ATTEMPTS = 8;

test.describe('Login — brute-force protection (known defect) @known-defect', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('LGN-08 · repeated failed logins are eventually throttled or locked out', async ({ steps }) => {
    test.setTimeout(240_000);

    // Mint a disposable account so a real lockout, if one existed, could not
    // affect the shared account the rest of the suite logs in with.
    const user = buildUser();
    await signUpToDashboard(steps, user);
    await logOut(steps);

    const outcomes: string[] = [];

    for (let attempt = 1; attempt <= FAILED_ATTEMPTS; attempt++) {
      await submitLogin(steps, user.email, `wrong-password-${attempt}`);
      await steps.verifyPresence('errorAlert', LOGIN);
      outcomes.push(((await steps.getText('errorAlert', LOGIN)) ?? '').trim());
    }

    // Every attempt returning the identical credentials error means nothing
    // defensive ever engaged. Expected: by this point the app should respond
    // differently — a lockout notice, a challenge, or a throttle.
    const allIdentical = new Set(outcomes).size === 1;

    expect(
      allIdentical,
      `${FAILED_ATTEMPTS} consecutive failed logins all returned the identical response ` +
        `("${outcomes[0]}") — no lockout, challenge, or throttle engaged at any point.`,
    ).toBe(false);
  });
});
