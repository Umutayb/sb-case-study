import { test } from './fixtures/base';
import { buildUser, Routes } from './fixtures/test-data';
import { submitRegistrationForm } from './flows/signup-flow';

const SIGNUP = 'SignupPage';
const QUIZ = 'SignupQuestionnairePage';

/**
 * Client-side validation on the registration form — the `<missing>` gap in
 * journey-map-coverage.md for j-signup-onboard: "Error state — empty submit
 * / invalid email / invalid phone / weak password / unticked terms".
 *
 * Behaviour below was driven live against the app before writing any
 * assertion (see journey-map.md's j-signup-onboard `State variations:`,
 * confirmed independently here):
 *   - An empty submit marks all six required fields `aria-invalid="true"`,
 *     but only the phone field gets an inline message — the others get
 *     invalid styling with no text. This is inconsistent with the login
 *     form's explicit "X is required" pattern, but it is what the app does,
 *     so that is what is asserted.
 *   - An invalid email format shows "Invalid email" only once submission is
 *     attempted (not on blur).
 *   - A non-numeric phone number shows "Telephone number is invalid".
 *   - A weak password leaves the live 5-point requirement checklist with at
 *     least one unmet item (rendered as a red `exclamation-circle` icon per
 *     requirement; met requirements render a green `check` icon instead).
 *   - An unticked terms checkbox is marked `aria-invalid="true"` and blocks
 *     submission.
 *
 * Every scenario below blocks submission client-side before any request
 * that would create an account, so no test here mutates tenant data — no
 * `test.describe.configure({ mode: 'serial' })` and no cleanup hook are
 * needed (see test-composer's "what counts as a mutable endpoint").
 */
test.describe('Signup — form validation', () => {
  test.describe.configure({ timeout: 60_000 });

  test('submitting the form empty blocks submission and marks every required field invalid', async ({
    steps,
  }) => {
    await steps.navigateTo(Routes.SIGNUP, { waitUntil: 'domcontentloaded' });
    await steps.click('getStartedButton', SIGNUP);

    await steps.verifyAttribute('firstName', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyAttribute('lastName', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyAttribute('email', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyAttribute('mobileNumber', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyAttribute('password', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyAttribute('termsCheckbox', SIGNUP, 'aria-invalid', 'true');

    // Only the phone field gets an explicit inline message on an empty
    // submit — asserted both ways so a future fix that adds the email
    // message (making the form more consistent) is visible as a spec
    // change, not silently absorbed by a loose assertion.
    await steps.verifyPresence('phoneInvalidError', SIGNUP);
    await steps.verifyAbsence('emailInvalidError', SIGNUP);

    // Blocked: still on the registration step, not the questionnaire.
    await steps.verifyPresence('heading', SIGNUP);
    await steps.verifyAbsence('businessName', QUIZ);
  });

  test('an invalid email format is rejected with an inline "Invalid email" message', async ({
    steps,
  }) => {
    const user = buildUser({ email: 'not-an-email' });

    await submitRegistrationForm(steps, user);

    await steps.verifyPresence('emailInvalidError', SIGNUP);
    await steps.verifyAttribute('email', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyPresence('heading', SIGNUP);
    await steps.verifyAbsence('businessName', QUIZ);
  });

  test('a non-numeric phone number is rejected with an inline "Telephone number is invalid" message', async ({
    steps,
  }) => {
    const user = buildUser({ mobileNumber: 'abc-not-a-phone' });

    await submitRegistrationForm(steps, user);

    await steps.verifyPresence('phoneInvalidError', SIGNUP);
    await steps.verifyAttribute('mobileNumber', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyPresence('heading', SIGNUP);
    await steps.verifyAbsence('businessName', QUIZ);
  });

  test('a weak password leaves the requirement checklist unmet and blocks submission', async ({
    steps,
  }) => {
    // Satisfies "contains a number" and "contains a lowercase letter" but
    // fails length (<10), special-character, and uppercase — confirms the
    // checklist reflects genuinely unmet items rather than a single
    // pass/fail flag.
    const user = buildUser({ password: 'abc123' });

    await submitRegistrationForm(steps, user);

    await steps.verifyCount('passwordUnmetRequirement', SIGNUP, { greaterThan: 0 });
    await steps.verifyAttribute('password', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyPresence('heading', SIGNUP);
    await steps.verifyAbsence('businessName', QUIZ);
  });

  test('an unticked terms checkbox blocks submission', async ({ steps }) => {
    const user = buildUser();

    await submitRegistrationForm(steps, user, { acceptTerms: false });

    await steps.verifyAttribute('termsCheckbox', SIGNUP, 'aria-invalid', 'true');
    await steps.verifyPresence('heading', SIGNUP);
    await steps.verifyAbsence('businessName', QUIZ);
  });
});
