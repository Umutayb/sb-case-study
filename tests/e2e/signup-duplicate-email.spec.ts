import { test } from './fixtures/base';
import { buildUser } from './fixtures/test-data';
import { readAccount } from './fixtures/auth';
import { submitRegistrationForm } from './flows/signup-flow';
import { submitLogin } from './flows/login-flow';

/**
 * DEFECT — signup does not enforce email uniqueness, and fails silently.
 *
 * Observed on the demo environment on 2026-08-12:
 *
 *   1. Register with an email that already has an account. The form accepts
 *      it. No "email already in use" error appears, on the form or later.
 *   2. The flow proceeds into the questionnaire and setup wizard exactly as
 *      a real registration would, and reaches the dashboard.
 *   3. The password chosen during that second registration does NOT work at
 *      login — it is rejected with the standard credentials error.
 *   4. The original account's password still works.
 *
 * User impact: someone who forgets they already have an account re-registers,
 * chooses a new password, completes the entire onboarding, and is then locked
 * out — with no message at any point explaining why. The failure is silent
 * and the wasted effort is total.
 *
 * These tests describe the behaviour the product should have. They are marked
 * `fixme` rather than deleted or weakened, because the suite's job is to
 * describe correct behaviour — not to be adjusted until a bug looks like a
 * feature. Remove the `fixme` markers once the defect is fixed and they
 * become the regression guard.
 */
test.describe('Signup — duplicate email (known defect)', () => {
  test.fixme('registering an already-used email is rejected', async ({ steps }) => {
    const existing = readAccount();
    const user = buildUser({ email: existing.email });

    await submitRegistrationForm(steps, user);

    // Expected: the form refuses the duplicate and says so.
    // Actual: it proceeds into the questionnaire as if registration succeeded.
    await steps.verifyPresence('errorAlert', 'LoginPage');
    await steps.verifyUrlContains('/signup');
  });

  test.fixme(
    'a password set during a duplicate registration actually works',
    async ({ steps }) => {
      const existing = readAccount();
      const user = buildUser({ email: existing.email });

      await submitRegistrationForm(steps, user);
      await submitLogin(steps, user.email, user.password);

      // Expected: either the registration was rejected outright (covered
      // above), or the credentials it accepted are usable. Silently accepting
      // a password that never works is the defect.
      await steps.verifyAbsence('errorAlert', 'LoginPage');
    },
  );
});
