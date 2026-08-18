import { test } from '../fixtures/base';
import { buildUser } from '../data/test-data';
import { submitRegistrationForm } from '../flows/signup-flow';

const QUIZ = 'SignupQuestionnairePage';

/**
 * DEFECT — the questionnaire's "Number of employees" field accepts values
 * its own HTML attributes declare invalid, and lets the user proceed anyway.
 *
 * These tests FAIL on purpose. See the README's defect section and
 * `tests/e2e/docs/.subagent-returns/phase6-probe-j-signup.md`, finding
 * `j-signup-onboard-02`.
 *
 * Reproduced on the demo environment on 2026-08-14:
 *
 *   The field renders as `<input id="estimated_users" type="number" min="1"
 *   step="1">` — no `max`. Its own attributes declare a whole-number
 *   headcount with no upper bound. But:
 *
 *     - A decimal (e.g. "3.33") violates `step="1"` — the input's own
 *       `validity.valid` reports `false` for it — yet the field is never
 *       marked invalid and the questionnaire's Next button enables exactly
 *       as it would for a valid whole number.
 *     - An unbounded integer (e.g. "999999999999999", 15 digits) has no
 *       `max` to violate, but is equally nonsensical as a headcount; no
 *       upper bound is enforced anywhere — Next enables identically.
 *
 * Confirmed twice by a probe and independently reproduced by a refuting
 * verifier; see the referenced report for the full boundary sweep (0, -5, 1,
 * 2.5, 10.99, 999999999999999) and a captured `POST /api/signup` body
 * showing `"estimated_users": 3.33` accepted by the server unmodified.
 *
 * User impact: nothing in the UI stops a fat-fingered or malicious decimal,
 * or an absurd headcount, from reaching account setup, where it likely feeds
 * seat-count-based billing/plan logic downstream.
 *
 * Asserted here as "Next must stay disabled" — the same client-side gate the
 * app already uses to correctly hold the user on this step for `0` or a
 * negative number, per the field's own `min`/`step` attributes. Only
 * questionnaire step 1 is reached; the signup is never completed, so these
 * tests create no account.
 *
 * They are tagged `@known-defect` so they can be excluded from a run:
 *   npx playwright test --grep-invert @known-defect
 *
 * They are not weakened to assert the buggy behaviour. A suite that rewrites
 * itself to match a bug can no longer detect it.
 */
test.describe('Signup — employee count validation (known defect) @known-defect', () => {
  test.describe.configure({ timeout: 60_000 });

  test('SGN-12 · a decimal employee count does not block the Next button', async ({ steps }) => {
    const user = buildUser();
    await submitRegistrationForm(steps, user);

    await steps.verifyPresence('businessName', QUIZ);
    await steps.fill('businessName', QUIZ, user.businessName);
    await steps.fill('numberOfEmployees', QUIZ, '3.33');
    // Confirm the fill actually landed before asserting on Next — a fill
    // lost to the questionnaire's own re-render race (documented in
    // signup-flow.ts) would make this assertion meaningless.
    await steps.verifyInputValue('numberOfEmployees', QUIZ, '3.33');

    // Expected: min="1" step="1" on the field itself implies whole numbers
    // only, so Next should stay disabled for a fractional value.
    // Actual: Next enables exactly as it would for a valid integer.
    await steps.expect('nextButton', QUIZ).timeout(8000).enabled.toBe(false);
  });

  test('SGN-13 · an unbounded employee count does not block the Next button', async ({ steps }) => {
    const user = buildUser();
    await submitRegistrationForm(steps, user);

    await steps.verifyPresence('businessName', QUIZ);
    await steps.fill('businessName', QUIZ, user.businessName);
    await steps.fill('numberOfEmployees', QUIZ, '999999999999999');
    await steps.verifyInputValue('numberOfEmployees', QUIZ, '999999999999999');

    // Expected: a 15-digit headcount is not a plausible answer for any real
    // business; Next should stay disabled the same way it correctly
    // disables for 0 or a negative number.
    // Actual: Next enables exactly as it would for a valid integer.
    await steps.expect('nextButton', QUIZ).timeout(8000).enabled.toBe(false);
  });
});
