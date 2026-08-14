import { test, expect } from './fixtures/base';
import { buildUser } from './fixtures/test-data';

/**
 * DEFECT — POST /api/signup returns a raw HTML 500 instead of a structured
 * validation error when the questionnaire-derived fields are missing from
 * the payload.
 *
 * This test FAILS on purpose. It describes how the endpoint should behave;
 * the endpoint does not behave that way today, so the suite reports it. See
 * finding `j-signup-onboard-04` (low severity) in
 * `tests/e2e/docs/.subagent-returns/phase6-probe-j-signup.md` for the full
 * repro and analysis.
 *
 * Reproduced on the demo environment on 2026-08-14:
 *
 *   1. Load /signup (fresh, unauthenticated) to establish the anonymous
 *      session — the `XSRF-TOKEN` cookie the endpoint's CSRF check expects,
 *      carried automatically by the session-aware request below.
 *   2. POST /api/signup with only the core registration fields — omitting
 *      `company`, `estimated_users`, and every questionnaire-derived field
 *      (industry, industry_group, buyer_role, situation, pain,
 *      critical_event, buyer_intent, intent_urgency).
 *   3. The endpoint throws an unhandled server exception: HTTP 500, body
 *      `<h2>An Internal Error Has Occurred.</h2>` (HTML, not JSON) — unlike
 *      the rest of this API surface (e.g. /api/signup/validate-email),
 *      which returns a clean JSON error envelope on rejection.
 *
 * No account is created by this payload — confirmed in the source finding
 * via a follow-up login attempt returning the standard "unknown
 * credentials" response — so this test has no side effect on the shared
 * demo environment; every run mints a fresh, never-persisted email address
 * and neither succeeds nor partially registers anything.
 *
 * It is tagged `@known-defect` so it can be excluded from a run:
 *   npx playwright test --grep-invert @known-defect
 *
 * It is not weakened to assert the buggy 500. A suite that rewrites itself
 * to match a bug can no longer detect it.
 */
test.describe('Signup API contract — missing questionnaire fields (known defect) @known-defect', () => {
  test('POST /api/signup returns a structured client error, not a raw 500, when questionnaire fields are missing', async ({
    steps,
  }) => {
    // Establishes the anonymous session the endpoint needs: loading /signup
    // sets the first-party XSRF-TOKEN cookie, which the session-aware
    // request below carries automatically (it shares the browser context's
    // cookie jar). Deliberately does NOT depend on `rl_anonymous_id` — that
    // cookie is set asynchronously by a third-party analytics SDK and is
    // not reliably present immediately after navigation; the endpoint's 500
    // reproduces identically without an `x-anonymous-id` header (verified
    // against the live endpoint while composing this test), so leaving it
    // out keeps the test deterministic instead of racing a third party.
    await steps.navigateTo('/signup');

    const user = buildUser();

    // Deliberately incomplete: only the core registration fields are sent.
    // `company`, `estimated_users`, and every questionnaire-derived field
    // are omitted — this is the payload shape that reproduces the 500
    // documented in finding j-signup-onboard-04.
    const res = await steps.requestPost('/api/signup', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-shiftbase-csrf-protection': '1',
        'x-app-type': 'Web App',
        'x-app-locale': 'en-GB',
        'x-app-version': '2.272.1',
      },
      data: {
        Account: {
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          phone_nr: user.mobileNumber,
          password: user.password,
          accept_conditions: true,
          marketing_opt_in: false,
          country: 'NL',
          locale: 'en-GB',
        },
      },
    });

    const contentType = res.headers['content-type'] ?? '';
    const bodySnippet = (await res.text()).slice(0, 200);

    // Expected: a structured client error (4xx, JSON body naming the
    // missing/invalid field) — consistent with the rest of this API surface
    // (e.g. /api/signup/validate-email returns clean JSON on rejection).
    // Actual: HTTP 500 with a raw, non-JSON HTML body
    // ("<h2>An Internal Error Has Occurred.</h2>").
    expect(
      res.status,
      `expected a structured client error (< 500), got ${res.status} ` +
        `content-type="${contentType}" body="${bodySnippet}"`,
    ).toBeLessThan(500);
    expect(contentType, 'error body should be JSON, not HTML').not.toContain('text/html');
  });
});
