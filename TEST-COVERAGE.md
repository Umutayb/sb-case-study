# Test coverage & bug findings

A walkthrough of every test in the suite and every defect found while building
it. For how to run the suite and the higher-level reasoning, see the
[README](README.md); for the raw adversarial reproductions, see
[`tests/e2e/docs/adversarial-findings.md`](tests/e2e/docs/adversarial-findings.md).

---

## At a glance

| | Count |
|---|---|
| Total tests | **29** |
| Passing | **23** |
| Failing on purpose (`@known-defect`) | **6** |
| Spec files | 11 (+ 1 setup) |
| Pages mapped | 6 |
| Defects found | **11** (3 while building, 8 from a dedicated adversarial pass) |

Two run commands:

```bash
npm test                # 23 passed, 6 failed  — the 6 are @known-defect, they fail by design
npm run test:no-defects # 23 passed, 0 failed  — the suite minus the known-defect tests
```

The 6 failures are **intentional**. Each `@known-defect` test describes the
behaviour the product *should* have; it fails today and turns green the day the
bug is fixed. 
See [Bug findings](#bug-findings) below.

---

## How the suite is organised

**Three Playwright projects** (`playwright.config.ts`):

| Project | Runs | Purpose |
|---|---|---|
| `setup` | first, once | Resolves the account the login tests use — see below. |
| `chromium` | the bulk | Every desktop test (excludes `@mobile`). |
| `mobile` | `@mobile`-tagged only | Pixel-7 viewport checks. |

**The account problem.** Login needs an account, and committing credentials is
not an option. The `setup` project resolves one before any login test runs:

- If `.env` supplies `SB_EMAIL` / `SB_PASSWORD`, it uses that account.
- Otherwise it **mints one by running the real signup flow**, and persists the
  credentials to a gitignored file the login tests read.

That fallback is what lets a cold clone run green with no configuration, and it
means signup is exercised on every run, not only when its own spec runs.

**Interaction style.** Every test drives the app through the
`@civitas-cerebrum/element-interactions` Steps API; selectors live in
`tests/e2e/page-repository.json`, one entry per element, referenced by name. No
raw `page.locator` / `page.goto` appears in any test body.

**Reusable flows.** The multi-step journeys live in `tests/e2e/flows/` so they
are written once and shared: `signup-flow.ts` (registration → questionnaire →
wizard → dashboard) and `login-flow.ts` (submit → MFA interstitial →
dashboard).

---

## Passing tests (23)

### Signup & onboarding — `signup.spec.ts`

| Test | What it does | Why it earns a place |
|---|---|---|
| **a new trial account reaches the dashboard** | The full flow: registration → 8-step questionnaire → setup wizard → dashboard. Asserts the first-run dialog is genuinely dismissed, then that the dashboard panels render. | The flow the brief names — the suite's spine. |
| **the registration form hands off to the questionnaire** | Submits registration and asserts the questionnaire content appears. | The handoff is invisible in the URL (`/signup` stays put), so it needs its own assertion rather than a URL check. |
| **the registration form is usable on a mobile viewport** `@mobile` | Loads registration at a Pixel-7 width and confirms the fields and CTA are usable. | Narrow-viewport layout is where signup forms break first. Deliberately not a full mobile questionnaire walk — that would double runtime to re-prove desktop logic. |

### Signup form validation — `signup-validation.spec.ts`

Signup had no negative coverage while login had five; these close that gap. The
app marks all six required fields `aria-invalid` but *tells* the user something
different per field, so the assertions target the reliable signal.

| Test | Asserts |
|---|---|
| **submitting the form empty blocks submission and marks every required field invalid** | All six fields get `aria-invalid`; the form does not navigate. |
| **an invalid email format is rejected with an inline "Invalid email" message** | Email validates on submit (not on blur) with the documented message. |
| **a non-numeric phone number is rejected with an inline "Telephone number is invalid" message** | The one field that surfaces inline error text. |
| **a weak password leaves the requirement checklist unmet and blocks submission** | Password has no text error — it renders a live five-item checklist; the test counts unmet items. |
| **an unticked terms checkbox blocks submission** | A required legal consent that must not be bypassable *in the UI*. (The server does not enforce it — see finding A1.) |

### Signup questionnaire persistence — `signup-persistence.spec.ts`

| Test | What it pins |
|---|---|
| **leaving the signup flow and returning discards questionnaire progress** | Navigating away and back loses all answers and returns to step 1. Pinned as *designed* behaviour, not a defect — not persisting half-entered credentials across an SPA exit is defensible, and the in-app `Back` button does preserve answers. If the product ever adds resume, this test notices. |

### Login — `login.spec.ts`

| Test | What it does |
|---|---|
| **valid credentials reach the dashboard** | Logs in, passes through the MFA interstitial, lands on the dashboard, asserts the panels render. |
| **login is offered multifactor authentication before the dashboard** | Asserts the `/login/mfa-promote` screen explicitly. It is part of the journey; if it vanished, login would have changed shape and a test should say so. |

### Login — rejected attempts — `login-negative.spec.ts`

| Test | Asserts |
|---|---|
| **submitting an empty form reports both required fields** | Inline "Email is required" / "Password is required"; no navigation. |
| **a wrong password is rejected** | The credentials error, still on `/login`. |
| **an unknown email is rejected** | The same, from the other direction. |
| **rejection does not reveal whether the account exists** | The strongest assertion in the suite: the wrong-password message and the unknown-account message are **byte-identical**, so the form cannot be used as an account-enumeration oracle. |
| **a logged-out visitor cannot reach the dashboard directly** | Route guarding — a direct dashboard request while logged out redirects to `/login`. |

### Session — `session.spec.ts`

| Test | Asserts |
|---|---|
| **an authenticated session survives a reload** | After a reload the dashboard still *renders* — not merely that the URL held, since the app could keep the route while dropping the session. |
| **the dashboard exposes the primary navigation** | A cheap structural check that the landing surface really is the dashboard. |

### Login — session & MFA-branch edges — `login-session-edges.spec.ts`

| Test | Asserts |
|---|---|
| **"Back to login" on the MFA prompt silently terminates the session** | This button looks like a passive back-link but is a logout in disguise. Pinned precisely because it is surprising. |
| **the login form is usable on a mobile viewport** `@mobile` | Same reasoning as signup's mobile check. |
| **logging out of one session does not affect a concurrent session for the same account** | Documents the app's actual multi-session behaviour rather than assuming single-session semantics. Uses a dedicated minted account so it can't disturb sibling tests. |
| **a session invalidated mid-interaction redirects to login instead of hanging or blanking** | Clears the session cookie, then triggers an API-bound action; the app redirects cleanly rather than freezing. (The session is cookie-only — `shifttime`, HttpOnly/Secure/SameSite=Strict — so clearing the cookie is a faithful stale-session simulation.) |

### Account provisioning — `setup/account.setup.ts`

| Test | What it does |
|---|---|
| **resolve an account for the login specs** | The `setup` project's single test — supplies the `.env` account, or mints one via the signup flow. Every login test depends on it. |

---

## Bug findings

Eleven confirmed defects, **zero false positives**. Three were found while
building the suite; eight came from a dedicated adversarial pass in which every
finding was reproduced, then handed to an independent verifier whose only job
was to *disprove* it. None was refuted, and three had their severity corrected
by the verifier — the corrections are the evidence the refutation was real.

Four findings became `@known-defect` regression tests; the other seven are
documented with the reason they are reported rather than automated. A finding
that can only be shown with an on-demand gateway error, a destructive
rate-limit probe, a wall-clock timing threshold, or an exploit that shouldn't
run on every CI trigger makes a worse test than a clear report.

### Found while building (3)

#### B1 — An unrecognised modal route blanks the application · **automated**
Navigating to `/dashboard/my-overview(modal:<anything-unrecognised>)` makes the
Angular Router raise `NG04002`, collapses the URL to `/`, and renders a
**completely empty page** (`document.body.innerText` is zero characters). It
matters because the signup flow itself lands on `(modal:onboarding-welcome)` /
`(modal:highlights)`, so those routes reach real bookmarks and history — retire
a modal and every saved link becomes a blank white screen.
*Test:* `router-malformed-modal.spec.ts` · *Evidence:* `defect-evidence/01-*`

#### B2 — Signup accepts a duplicate email, then rejects the password it accepted · **automated**
Registering with an already-registered email is accepted with no conflict
error, walks the entire onboarding to the dashboard — and then the password
chosen during that second registration is **rejected at login**, while the
original account's password still works. A user who forgets they signed up
before completes the whole flow and is silently locked out.
*Tests:* `signup-duplicate-email.spec.ts` (2 cases) · *Evidence:* `defect-evidence/02-*`, `03-*`

#### B3 — First and last name have no length limit · **reported**
A 300-character first name is accepted and rendered verbatim into the
"Welcome, &lt;name&gt;." heading, overflowing the viewport with no wrapping.
Reported without a test: asserting "the layout is broken" needs a
visual-regression baseline this environment cannot support (the trial banner
counts down daily, the first-run modal varies per run). The fix is a `maxlength`
plus truncation; a meaningful test comes after that.

### Adversarial pass (8)

Full reproductions in
[`adversarial-findings.md`](tests/e2e/docs/adversarial-findings.md); evidence in
[`tests/e2e/docs/screenshots/`](tests/e2e/docs/screenshots/).

#### A1 — Terms / DPA acceptance is enforced only client-side · **high · reported**
`POST /api/signup` accepts a fully-valid payload with `accept_conditions:
false` and returns HTTP 200, creating a real, usable account — the required
consent checkbox has **no server-side counterpart**. Reproduced from two fresh
sessions, each followed by a successful login. On a workforce platform that will
process employees' personal data, an account created with a false record of DPA
acceptance is a genuine compliance concern. **Reported, not automated on
purpose:** a regression test would replay a compliance-bypass exploit on every
CI run against a shared environment. The fix belongs server-side — reject
`accept_conditions: false` at the endpoint. *This is the single most important
finding, and the one no amount of UI testing would reach.*

#### A2 — "Number of employees" accepts fractional and unbounded values · **medium · automated**
The field (`<input type="number" min="1" step="1">`, no `max`) accepts `3.33`
and `999999999999999`; `Next` enables as for a valid integer and the value
reaches `POST /api/signup` verbatim. The test asserts the *client* gate should
block it — which needs no account creation, so the regression guard has no side
effect on the shared environment.
*Tests:* `signup-employee-count.spec.ts` (2 cases) · *Evidence:* `defect-evidence/04-*`

#### A3 — `POST /api/signup` returns a raw HTML 500 on a missing-field payload · **low · automated**
Omitting the questionnaire-derived fields makes the endpoint throw an unhandled
exception (`<h2>An Internal Error Has Occurred.</h2>`, HTML, not JSON) rather
than a structured 4xx. No account is created, so there is no data-integrity
fallout — an error-handling gap only. The contract test derives everything live
(no hardcoded reCAPTCHA/cookies) so it fails deterministically on the assertion.
**UI-side checked:** a user cannot reach this through the browser — the
Angular reactive form re-validates on `Next` and blocks advancing without
valid input, holding even when the disabled `Next` button is force-enabled via
the DOM (verified on the registration and industry/role steps; no `/api/signup`
call fired). The incomplete payload is only reachable by calling the endpoint
directly, so this is an API-contract gap with no user-facing path.
*Test:* `signup-api-contract.spec.ts`

#### A4 — Login timing side-channel re-opens account enumeration · **medium · reported**
The login form returns byte-identical error copy for a wrong password vs an
unknown account (a deliberate anti-enumeration control — see the passing
`login-negative` test), but response *timing* differs measurably between the two
cases, re-opening the channel the identical copy was meant to close (CWE-203).
Reported: timing assertions are statistical and rot into flakiness.

#### A5 — No rate limiting or lockout on `POST /api/auth/login` · **high · reported**
Ten consecutive failed logins drew no throttle, lockout, or CAPTCHA — notably,
the sibling forgot-password endpoint *does* rate-limit (returns 429), so this is
an inconsistency, not a platform-wide absence. Reported: a test would have to
make many failed attempts against a shared box, and "nothing happened after N"
is a weak, slow assertion.

#### A6 — Gateway errors shown to the user as "Email or password is incorrect." · **medium · reported**
On a 502/504 gateway response to a login with **verified-correct** credentials,
the form shows the bad-credentials alert — telling the user their password is
wrong when the service is down. Reported: the trigger (a real 502/504) cannot be
produced on demand without mocking the backend, which would test the mock.

#### A7 — Forgot-password rate-limit message is swallowed · **medium · reported**
The forgot-password endpoint correctly rate-limits, but the UI reports the
throttle as a generic "Something went wrong, please try again" rather than the
backend's specific, actionable text — telling the user to retry when retrying
will keep failing for up to an hour. Reported: reproducing it requires tripping
the real rate limit against the shared box.

#### A8 — Questionnaire step 2 has no Back button · **low · reported**
Every other mid-wizard step carries a `Back` button; step 2 (business
type/industry/role) has none, contradicting the bidirectional navigation the
rest of the wizard offers. Reported: asserting the *absence* of a control as a
defect is a weak regression guard, and this is a minor UX inconsistency.

---

## Test ↔ finding cross-reference

| Test file | Kind | Finding covered |
|---|---|---|
| `router-malformed-modal.spec.ts` | `@known-defect` | B1 |
| `signup-duplicate-email.spec.ts` | `@known-defect` (×2) | B2 |
| `signup-employee-count.spec.ts` | `@known-defect` (×2) | A2 |
| `signup-api-contract.spec.ts` | `@known-defect` | A3 |
| *(reported, no test)* | — | B3, A1, A4, A5, A6, A7, A8 |

---

## What was deliberately not covered

Stated so the omissions read as decisions, not gaps:

- **Everything past the dashboard** — the brief scopes the flow to reaching the
  dashboard; scheduling, timesheets, absence, payroll are out.
- **Password reset** — reachable from `/login/forgot`, but outside both named
  flows.
- **An exhaustive field-validation matrix** — one representative case per
  validation class instead of every field × every rule.
- **Cross-browser** — Chromium only; the config takes a browser matrix in one
  line, but three browsers on a demo environment buy little for the runtime.
- **Visual regression** — no stable baseline story on an environment that
  resets and whose trial banner counts down.
- **Load / performance** — out of scope for a functional brief, and impolite on
  someone else's demo box.
