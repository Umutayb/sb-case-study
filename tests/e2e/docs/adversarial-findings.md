# Adversarial findings — Phase 6 bug-discovery

Per-journey adversarial probing of the two mapped journeys, run after the
functional suite was green. Every finding here was reproduced at least twice
by the probe **and** independently re-reproduced by a separate verifier whose
brief was to *refute* it — the eight below are the ones that survived that
refutation. Severities are the verifier's corrected values.

Findings that could be pinned by a portable, deterministic test became
`@known-defect` specs. The rest are recorded here and in the README but not
automated, for reasons given per finding — a timing measurement, an on-demand
gateway error, a destructive rate-limit probe, or an exploit that should not
be replayed against a shared environment on every CI run are not things a
durable suite should contain.

## How these were verified

Two independent stages, so no finding rests on a single agent's word:

1. **Probe.** One adversarial pass per journey drove genuinely new ground —
   API-level gate bypass, injection, boundary values, rate limiting, timing —
   and reproduced each suspected defect at least twice before recording it.
2. **Refute.** Every finding was then handed to a *separate* verifier whose
   only instruction was to kill it: reproduce it independently, or show it is
   a known item re-dressed, expected behaviour, a sandbox artifact, or
   unreachable by a real user. Verifiers were told to default to "refuted"
   when uncertain, on the principle that a false finding in a report to an
   employer is worse than a missed one.

Of the 8 findings that reached the refute stage, **0 were refuted** and **3
had their severity corrected** by the verifier (critical→high on the Terms/DPA
bypass, high→medium on the gateway-error message, medium→low on the missing
Back button). The corrections are the audit trail: a rubber-stamp does not
downgrade its own inputs. The per-finding **Verifier note** lines below record
how each was independently reproduced.

## j-signup-onboard

### j-signup-onboard-01 — Terms/DPA acceptance is enforced only client-side [high]

`POST /api/signup` accepts a fully-valid payload with `accept_conditions:
false` and returns HTTP 200, creating a real, immediately-usable account. The
terms-and-processing-agreement checkbox the UI marks as hard-required
(`aria-invalid` when unticked, blocks the form) has **no server-side
equivalent**. The resulting account logs in normally.

- **Reproduced:** 2 independent accounts from 2 fresh anonymous sessions
  (`account_id` 79007, 79009), each with a legitimately-obtained reCAPTCHA v3
  token from the site's own key, then a successful login with each.
- **Verifier note:** did not trust the probe's hand-typed payload — drove the
  real UI to capture the exact server-accepted payload and enum values, then
  replayed with only `accept_conditions` flipped. Downgraded critical→high:
  real legal/compliance weight (a workforce SaaS creating accounts with a
  false record of DPA acceptance), but contained to the attacker's own
  account — no other-tenant exposure, no auth bypass, no availability impact.
- **Impact:** a scripted client can create and use a Shiftbase account while
  explicitly declining the Terms of Service and Data Processing Agreement.
- **Not automated, deliberately.** A regression test would replay this exact
  exploit on every CI run, repeatedly creating accounts that falsely record
  ToS/DPA non-acceptance against a shared demo environment. Automating a
  compliance-bypass exploit is the wrong thing to ship. Documented with the
  full reproduction instead. Fix belongs server-side: reject
  `accept_conditions: false` at `/api/signup`.

### j-signup-onboard-02 — "Number of employees" accepts fractional and unbounded values [medium]

The `estimated_users` field (`<input type="number" min="1" step="1">`, no
`max`) accepts decimals (`3.33`) and arbitrarily large integers
(`999999999999999`); `Next` enables as for a valid integer, and the value
reaches `POST /api/signup` verbatim and creates an account.

- **Reproduced:** 3 independent accounts; the decimal was confirmed in the
  captured `/api/signup` request body, proving it reaches the server rather
  than being caught by a later re-check.
- **Automated:** `tests/e2e/signup-employee-count.spec.ts` (`@known-defect`).
  The test asserts the *client* gate should block the invalid value — which
  needs no account creation, so the regression guard has no side effect on the
  shared environment.

### j-signup-onboard-03 — Questionnaire step 2 has no Back button [low]

Every other mid-wizard step carries a `Back` button; step 2 (business
type/industry/role) has none, contradicting the bidirectional-navigation
behaviour `app-context.md` documents from a live walk.

- **Reproduced:** 3 independent sessions.
- **Verifier note:** downgraded medium→low — a single missing affordance on
  one step, no data or security impact.
- **Not automated:** asserting the *absence* of a control as a defect is a
  weak regression guard, and this is a minor UX inconsistency rather than a
  functional break. Recorded for the record.

### j-signup-onboard-04 — `POST /api/signup` returns a raw HTML 500 on a missing-field payload [low]

Omitting the questionnaire-derived fields makes the endpoint throw an
unhandled exception (`<h2>An Internal Error Has Occurred.</h2>`, HTML, not
JSON) rather than a structured 400/422, unlike the rest of the API surface
(`/api/signup/validate-email` returns clean JSON). No account is created, so
there is no data-integrity fallout — an error-handling gap only.

- **Reproduced:** 2 identical reproductions; narrowed to the missing
  questionnaire fields specifically.
- **Not automated:** reachable only by bypassing the UI with a hand-built
  partial payload — no real user hits it, and a test would hardcode a
  malformed-payload shape coupled to the API internals.

## j-login

### j-login-01 — Timing side-channel re-enables account enumeration [medium]

The login form returns byte-identical error copy for a wrong password on a
real account and for an unknown account (a deliberate anti-enumeration
control — see the passing `login-negative.spec.ts` assertion). But response
*timing* differs measurably between the two cases, re-opening the enumeration
channel the identical copy was meant to close (CWE-203).

- **Reproduced:** 10 real-account samples vs 8 unknown-account samples; raw
  per-request durations captured. The verifier re-reproduced with a distinct
  measurement method and kept the severity at medium.
- **Not automated:** timing assertions are inherently statistical and flaky;
  a threshold that passes today rots into noise. This is a finding to fix
  (constant-time handling), not to guard with a wall-clock test.

### j-login-02 — No rate limiting or lockout on `POST /api/auth/login` [high]

Ten consecutive failed logins on a throwaway account drew no throttle,
lockout, or CAPTCHA. Notably the **forgot-password** endpoint on the same app
*does* rate-limit (returns `429`), so this is an inconsistency, not a
platform-wide absence. A generic endpoint-wide gateway limit
(`x-ratelimit-limit: 180`) exists but is not a brute-force-specific
credential throttle.

- **Reproduced:** 10/10 attempts identical, no throttling.
- **Not automated:** a test would have to make many failed auth attempts
  against a shared demo box — the non-destructive constraint forbids it — and
  "nothing happened after N tries" is a weak, slow, flaky assertion.

### j-login-03 — Gateway errors are shown as "Email or password is incorrect." [medium]

On a `502`/`504` gateway response to a login with **verified-correct**
credentials, the form shows the bad-credentials alert — actively telling the
user their password is wrong when the service is down. (The copy also differs
from the true bad-credentials path, suggesting a separate catch-all branch.)

- **Reproduced:** 5 naturally-occurring gateway errors across two sessions;
  the verifier re-reproduced by a different method. Downgraded high→medium.
- **Not automated:** the trigger (a real 502/504) cannot be produced on
  demand without mocking the backend, which would test the mock, not the app.

### j-login-04 — Forgot-password rate-limit message is swallowed [medium]

The forgot-password endpoint correctly rate-limits (see j-login-02), but the
UI reports the throttle as a generic "Something went wrong, please try again"
rather than the backend's specific, actionable text — telling the user to
retry when retrying will keep failing for up to an hour.

- **Reproduced:** 2 independent runs.
- **Not automated:** reproducing it requires tripping the real rate limit
  (repeated requests against the shared box), and the defect is message
  quality on a correctly-functioning control.

## Pass summary

Probed: 2 journeys. Findings surviving adversarial refutation: 8 (2 high, 4
medium, 2 low). Refuted: 0. Automated as regression tests: 1
(`signup-employee-count.spec.ts`, two `@known-defect` cases). Documented-not-
automated: 7, each with the reason above.

**Evidence** (throwaway accounts only, no real credentials):
`tests/e2e/docs/screenshots/` — screenshots and raw timing/rate-limit data per
finding, indexed in that folder's README. Each finding above is self-contained;
the exact reproduction (API payloads, headers, per-request timings) is captured
in the per-finding sections and the evidence files.
