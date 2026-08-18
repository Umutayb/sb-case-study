# Test coverage & bug findings

A walkthrough of every test in the suite and every defect found while building
it. For how to run the suite and the higher-level reasoning, see the
[README](README.md); for the raw adversarial reproductions, see
[`tests/e2e/docs/adversarial-findings.md`](tests/e2e/docs/adversarial-findings.md).

---

## At a glance

| | Count |
|---|---|
| Total tests | **44** |
| Passing | **37** |
| Failing on purpose (`@known-defect`) | **7** |
| Spec files | 14 (+ 1 setup) |
| Pages mapped | 10 |
| Findings | **8** (3 while building, 4 from a dedicated exploratory pass, 1 while building the checklist tests) |

Two run commands:

```bash
npm test                # 37 passed, 7 failed  — the 7 are @known-defect, they fail by design
npm run test:no-defects # 37 passed, 0 failed  — the suite minus the known-defect tests
```

The 7 failures are **intentional**. Each `@known-defect` test describes the
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
`tests/e2e/data/page-repository.json`, one entry per element, referenced by
name. No raw `page.locator` / `page.goto` appears in any test body.

**Reusable flows.** The multi-step journeys live in `tests/e2e/flows/` so they
are written once and shared: `signup-flow.ts` (registration → questionnaire →
wizard → dashboard), `login-flow.ts` (submit → MFA interstitial → dashboard),
`onboarding-flow.ts` (the wizard's steps, asserted rather than clicked
through), and `checklist-flow.ts` (the guided checklist's tasks, its
progress readout, and the coach marks that sit on top of both).

---

## Passing tests (37)

### Signup & onboarding — `signup.spec.ts`

| Test | What it does | Why it earns a place |
|---|---|---|
| `SGN-01` **a new trial account reaches the dashboard** | The full flow: registration → 8-step questionnaire → setup wizard → dashboard. Asserts the first-run dialog is genuinely dismissed, then that the dashboard panels render. | The flow the brief names — the suite's spine. |
| `SGN-03` **the registration form hands off to the questionnaire** | Submits registration and asserts the questionnaire content appears. | The handoff is invisible in the URL (`/signup` stays put), so it needs its own assertion rather than a URL check. |
| **the registration form is usable on a mobile viewport** `@mobile` | Loads registration at a Pixel-7 width and confirms the fields and CTA are usable. | Narrow-viewport layout is where signup forms break first. Deliberately not a full mobile questionnaire walk — that would double runtime to re-prove desktop logic. |

### Signup form validation — `signup-validation.spec.ts`

Signup had no negative coverage while login had five; these close that gap. The
app marks all six required fields `aria-invalid` but *tells* the user something
different per field, so the assertions target the reliable signal.

| Test | Asserts |
|---|---|
| `SGN-04` **submitting the form empty blocks submission and marks every required field invalid** | All six fields get `aria-invalid`; the form does not navigate. |
| `SGN-05` **an invalid email format is rejected with an inline "Invalid email" message** | Email validates on submit (not on blur) with the documented message. |
| `SGN-06` **a non-numeric phone number is rejected with an inline "Telephone number is invalid" message** | The one field that surfaces inline error text. |
| `SGN-07` **a weak password leaves the requirement checklist unmet and blocks submission** | Password has no text error — it renders a live five-item checklist; the test counts unmet items. |
| `SGN-08` **an unticked terms checkbox blocks submission** | A required legal consent that must not be bypassable *in the UI*. (The server does not enforce it — see finding A1.) |

### Signup questionnaire persistence — `signup-persistence.spec.ts`

| Test | What it pins |
|---|---|
| `SGN-09` **leaving the signup flow and returning discards questionnaire progress** | Navigating away and back loses all answers and returns to step 1. Pinned as *designed* behaviour, not a defect — not persisting half-entered credentials across an SPA exit is defensible, and the in-app `Back` button does preserve answers. If the product ever adds resume, this test notices. |

### Login — `login.spec.ts`

| Test | What it does |
|---|---|
| `LGN-01` **valid credentials reach the dashboard** | Logs in, passes through the MFA interstitial, lands on the dashboard, asserts the panels render. |
| `LGN-02` **login is offered multifactor authentication before the dashboard** | Asserts the `/login/mfa-promote` screen explicitly. It is part of the journey; if it vanished, login would have changed shape and a test should say so. |

### Login — rejected attempts — `login-negative.spec.ts`

| Test | Asserts |
|---|---|
| `LGN-03` **submitting an empty form reports both required fields** | Inline "Email is required" / "Password is required"; no navigation. |
| `LGN-04` **a wrong password is rejected** | The credentials error, still on `/login`. |
| `LGN-05` **an unknown email is rejected** | The same, from the other direction. |
| `LGN-06` **rejection does not reveal whether the account exists** | The strongest assertion in the suite: the wrong-password message and the unknown-account message are **byte-identical**, so the form cannot be used as an account-enumeration oracle. |
| `LGN-07` **a logged-out visitor cannot reach the dashboard directly** | Route guarding — a direct dashboard request while logged out redirects to `/login`. |

### Session — `session.spec.ts`

| Test | Asserts |
|---|---|
| `SES-01` **an authenticated session survives a reload** | After a reload the dashboard still *renders* — not merely that the URL held, since the app could keep the route while dropping the session. |
| `SES-02` **the dashboard exposes the primary navigation** | A cheap structural check that the landing surface really is the dashboard. |

### Login — session & MFA-branch edges — `login-session-edges.spec.ts`

| Test | Asserts |
|---|---|
| `LGN-09` **"Back to login" on the MFA prompt silently terminates the session** | This button looks like a passive back-link but is a logout in disguise. Pinned precisely because it is surprising. |
| **the login form is usable on a mobile viewport** `@mobile` | Same reasoning as signup's mobile check. |
| `LGN-11` **logging out of one session does not affect a concurrent session for the same account** | Documents the app's actual multi-session behaviour rather than assuming single-session semantics. Uses a dedicated minted account so it can't disturb sibling tests. |
| `LGN-12` **a session invalidated mid-interaction redirects to login instead of hanging or blanking** | Clears the session cookie, then triggers an API-bound action; the app redirects cleanly rather than freezing. (The session is cookie-only — `shifttime`, HttpOnly/Secure/SameSite=Strict — so clearing the cookie is a faithful stale-session simulation.) |

### Onboarding wizard — `onboarding/wizard.spec.ts`

`signup.spec.ts` proves the wizard can be got *past*. These are about the
wizard itself.

| Test | Asserts |
|---|---|
| `ONB-01` **the wizard walks teams, employees and shift templates to the completion screen** | Each step is the step it claims to be, and arrives pre-filled as documented: the business name on teams, the registering user on employees, `Day shift` / 09:00 / 17:30 on templates. Also pins the progress bar at 83.33 on step 2 — it is shared with the signup questionnaire, so it measures the whole registration journey, and a wizard that gained or lost a step without moving it would mean the two had come apart. |
| `ONB-02` **a team added in the teams step is selectable against an employee** | The wizard's one observable cross-step effect. Asserted on the full option list, so a team going missing fails as loudly as one appearing twice. |
| `ONB-03` **skipping every step still reaches the completion screen** | `Skip` is not a dead end — the whole wizard is optional. |
| `ONB-04` **re-entering the wizard after finishing it starts over from the teams step** | Pins the documented no-memory behaviour. It is also what licenses `ONB-02`, `ONB-03` and `ONB-05` to re-enter by direct navigation instead of minting an account each. |
| `ONB-05` **abandoning the wizard part-way still leaves the dashboard reachable** | Pins the absence of a completion gate. If one is ever added, this is what notices. |

**One signup, five tests.** The file is serial: `ONB-01` mints the account
through the real signup and the rest log in. Re-minting per scenario would
spend half an hour re-proving `SGN-01`.

### Guided checklist — `onboarding/checklist.spec.ts`

The seven-task "Get started" checklist that outlives the wizard.

| Test | Asserts |
|---|---|
| `CHK-01` **a new account lands with one of seven tasks done** | All seven titles in render order, `Account created` already ticked, progress `14%`. Signing up *is* task 1, so a new account is never at zero. |
| `CHK-02` **expanding a task reveals its call to action and collapses the previous one** | Description and `Start` for the expanded task, then the expanded-task count after opening a second — which catches both halves at once: a second accordion that never opens, and a first that never closes. |
| `CHK-03` **completing a task ticks it off and moves the progress readout** | Drives `Download mobile app` to `Done!` — the one task with no product area behind it — and watches `14%` become `28%`. Then reloads: progress is account state, not view state, so a reload has to find it still done. |
| `CHK-04` **dismissing the checklist removes it for good** | No confirmation step, and it does not come back after a fresh page load. |

**Why this file is serial and owns its account.** Dismissal is account-level
and permanent. `CHK-04` burns the checklist for good, so it runs last against
an account nothing else still needs.

### Guided checklist — doing the tasks — `onboarding/checklist-tasks.spec.ts`

Each task's `Start` pressed and followed where it goes.

| Test | Asserts |
|---|---|
| `TSK-01` **dragging a shift template onto the schedule completes "Add your first shift"** | The suite's one drag and drop. `Start` routes to the schedule with `;onboardingStep=SCHEDULE_SHIFT`, the guided tour asks for a drag, and the `Day shift` template is dragged from the left panel onto an employee's day. Then: the shift renders, the checklist ticks the task and moves to `28%`, and a fresh page load finds the shift still there. |
| `TSK-02` **"Optimise your schedule" enables the scheduling defaults** | `Start quick setup` is not a preview — it turns availability management, open shifts and shift exchange on, and says so. The confirmation is the observable effect. |
| `TSK-03` **"Track employee hours" opens the time-tracking setup and unblocks on a choice** | The wizard refuses to advance until a tracking method is picked, so the disabled-then-enabled flip on `Next` is what proves the choice registered — the dialog looks identical either way. |
| `TSK-04` **taking the absence tour completes "Manage employee absences"** | Starting the tour is enough; the task ticks even when the tour is skipped rather than watched. Worth pinning precisely because it is the opposite of what tasks 3 and 4 do. |
| `TSK-05` **every task that stays incomplete keeps its call to action** | The counterweight to stopping at a handoff: tasks 3, 4 and 6 are asserted still incomplete, each still offering `Start`. Guards against a task that ticks itself just for having been opened. |
| `TSK-06` **"Invite your team" opens an invite dialog** `@known-defect` | Fails on purpose — the dialog mounts with zero children and a 750 × 2 px box. See **B8** below. Runs last, because a serial file stops at its first failure. |

**Three tasks complete, two hand off, one is broken.** Tasks 2, 5 and 7 tick
themselves off and the tests assert exactly that. Tasks 3 and 4 lead into
scheduling and time-tracking setup, which are past this journey's exit — the
tests assert the handoff and stop there rather than walking a five-step
time-tracking configuration, which would be testing time tracking.

**The thing that took longest to get right** was not the drag. It was
discovering that the tour splash has to be accepted *before* the coach marks
are cleared: clear first and the schedule's own walkthrough gets walked with
it, the onboarding context dies, and the shift that follows lands on the
schedule while the checklist quietly ignores it. Green test, no shift counted.
The ordering is commented in `checklist-flow.ts` where it matters.

### Account provisioning — `setup/account.setup.ts`

| Test | What it does |
|---|---|
| `SETUP-01` **resolve an account for the login specs** | The `setup` project's single test — supplies the `.env` account, or mints one via the signup flow. Every login test depends on it. |

---

## Bug findings

Eight findings, **zero false positives**. Three were found while building the
suite; four came from a dedicated exploratory pass in which every finding was
reproduced, then handed to an independent verifier whose only job was to
*disprove* it. None was refuted, and three had their severity corrected by the
verifier — the corrections are the evidence the refutation was real. The
eighth (**B8**) turned up later, while building the checklist tests, and did
not go through that second stage; its entry says so.

Five findings became `@known-defect` regression tests; the other three are
documented with the reason they are reported rather than automated. A finding
that can only be shown with an on-demand gateway error, a destructive
rate-limit probe, a wall-clock timing threshold, or an exploit that shouldn't
run on every CI trigger makes a worse test than a clear report.

### Found while building (4)

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

#### B8 — The checklist's "Invite your team" opens an empty dialog · **automated**
Pressing `Start` on checklist task 6 mounts `invite-employees-dialog` and it
renders nothing: **zero children**, and the `[role="dialog"]` around it
measures **750 × 2 pixels**. The page dims behind a modal with no content, no
fields, and no way to invite anyone — the task cannot be completed because its
flow never appears. Reproduced 3× on a freshly minted account, waiting up to
seven seconds each time for late rendering. The other six tasks render fine on
the same page load, and the console shows only the sandbox's usual blocked
third parties.

Unlike **A1–A4**, this one did not go through the independent refute stage —
it was found while building the checklist tests. What can be claimed is what
was observed, three times, on one environment.
*Test:* `onboarding/checklist-tasks.spec.ts` › `TSK-06`

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

#### A3 — No rate limiting or lockout on `POST /api/auth/login` · **high · automated**
Consecutive failed logins draw no throttle, lockout, or CAPTCHA — every attempt
returns the same credentials error. Notably the sibling forgot-password endpoint
*does* rate-limit (returns 429), so this is an inconsistency within the product,
not a platform-wide absence.
*Test:* `login-rate-limit.spec.ts` (`@known-defect`). It mints a **throwaway
account** so a real lockout could never strand the shared credentials, and keeps
the attempt count deliberately modest — enough to show no protection engages at
a threshold an attacker would clear trivially, not a brute-force run against
someone else's environment.

#### A4 — Questionnaire step 2 has no Back button · **low · reported**
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
| `login-rate-limit.spec.ts` | `@known-defect` | A3 |
| `onboarding/checklist-tasks.spec.ts` › `TSK-06` | `@known-defect` | B8 |
| *(reported, no test)* | — | B3, A1, A4 |

---

## What was deliberately not covered

Stated so the omissions read as decisions, not gaps:

- **Everything past the dashboard** — the brief scopes the flow to reaching the
  dashboard; scheduling, timesheets, absence, payroll are out. **One exception,
  by request:** the guided "Get started" checklist, which the brief's cutoff
  originally excluded and which was reopened explicitly. Its tasks lead into
  those same out-of-scope areas, so the tests assert each task's handoff and
  stop at the boundary — with `TSK-05` recording that they stopped, rather than
  leaving it implied.
- **The checklist's side panel** — the same checklist state also renders behind
  a sidebar "Get started" entry, which belongs to a navigation variant observed
  appearing and then disappearing for one account mid-session. A spec for it
  would fail on the variant rather than on the product.
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
