# Shiftbase — E2E test suite

End-to-end coverage of the two flows named in the assignment brief, against the
Shiftbase demo environment:

1. **Signup and onboarding** — from the signup form, through the profiling
   questionnaire and the setup wizard, to landing on the dashboard.
2. **Login.**

Playwright + TypeScript. Interactions go through the
[`@civitas-cerebrum/element-interactions`](https://www.npmjs.com/package/@civitas-cerebrum/element-interactions)
Steps API, so specs read as intent and no raw selector appears in a test body.

---

## Running it

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

That is the whole setup. **No `.env` is required** — verified by cloning this
repository fresh and running it with no configuration at all.

**A heads-up on the result before you run it:** `npm test` ends **23 passed,
5 failed**, and the 5 failures are *intentional*. They are tagged
`@known-defect` and they document real bugs found in the product — each
describes the behaviour the app *should* have, so it fails today and becomes a
regression guard the day the bug is fixed. This is a deliberate choice, not a
broken suite (the reasoning is under "Defects found while building this" and
"Adversarial findings" below). To run only the tests that should pass:

```bash
npm run test:no-defects        # 23 passed, 0 failed
```

`npm run test:report` opens the HTML report.

### Watching it run

```bash
npm run test:headed        # or: npx playwright test --headed
```

A headed run switches to a single worker and paces each action by 1000ms, so
the flows are actually followable instead of several browser windows racing
each other. Both entry points behave identically — the config detects the
`--headed` flag itself. Adjust the pace with `SLOW_MO`:

```bash
SLOW_MO=600 npm run test:headed
```

`npm run test:debug` adds the Playwright inspector on top.

### Optional configuration

Copy `.env.example` to `.env` if you want to point the suite elsewhere or use
your own account:

| Variable | Effect when set |
|---|---|
| `BASE_URL` | Target a different environment. |
| `SB_EMAIL` / `SB_PASSWORD` | Log in as an existing account instead of minting one. |
| `SB_SIGNUP_EMAIL_ROOT` | Derive signup addresses from your own mailbox via plus-addressing. |

### A note on the `achilles` devDependency

`@civitas-cerebrum/achilles` is the QA methodology used to author this suite.
Its `postinstall` registers agent hooks in `~/.claude/settings.json` and drops
skill files into your home directory. Nothing in the tests imports it, so if
you would rather it did not touch your machine:

```bash
npm ci --ignore-scripts
```

The suite runs identically either way. CI uses `--ignore-scripts`.

---

## What is covered

23 passing tests across three Playwright projects (`setup`, `chromium`,
`mobile`), plus 5 that fail on purpose against confirmed defects. Each one is
here because it covers a distinct way the flow can break, not to inflate a
count.

### Signup and onboarding

| Scenario | What it protects |
|---|---|
| A new trial account reaches the dashboard | The flow the brief names. Registration → 8-step questionnaire → setup wizard → dashboard, including asserting the first-run dialog is genuinely dismissed. |
| The registration form hands off to the questionnaire | The handoff is invisible in the URL — `/signup` stays put — so it needs its own assertion on the content that replaces the form. |
| The registration form is usable on a mobile viewport `@mobile` | Narrow-viewport layout is where signup forms break first. Deliberately not a full mobile questionnaire walk — see below. |
| Empty submit blocks and marks every required field invalid | The submit handler must fail closed. All six fields get `aria-invalid`, which is the reliable signal — inline text is inconsistent (see below). |
| An invalid email format is rejected | Validation fires on submit, not on blur. |
| A non-numeric phone number is rejected | The one field that does surface inline error text. |
| A weak password leaves the requirement checklist unmet | Password has no error message — it renders a live five-item checklist instead, so the assertion counts unmet items. |
| An unticked terms checkbox blocks submission | A required legal consent that must not be bypassable. |

### Login

| Scenario | What it protects |
|---|---|
| Valid credentials reach the dashboard | The flow the brief names. |
| Login is offered MFA before the dashboard | The `/login/mfa-promote` interstitial is part of the journey; if it vanished, login would have changed shape. |
| An empty submit reports both required fields | The submit handler must block, and must not navigate. |
| A wrong password is rejected | Must fail closed with the documented message. |
| An unknown email is rejected | The other half of failing closed. |
| Rejection does not reveal whether the account exists | Asserts the wrong-password and unknown-account messages are *identical*, so the form cannot be used as an account-enumeration oracle. |
| A logged-out visitor cannot reach the dashboard directly | Route guarding, approached from outside. |
| "Back to login" on the MFA prompt terminates the session | It looks like a passive back-link and is actually a logout. Pinned precisely because it is surprising. |
| The login form is usable on a mobile viewport `@mobile` | Same reasoning as signup's mobile check. |
| Logging out of one session leaves a concurrent one authenticated | Documents the app's actual multi-session behaviour rather than assuming single-session semantics. |
| An invalidated session redirects rather than hanging | The failure mode that matters: a dead session should send you to login, not blank or freeze. |

### Session

| Scenario | What it protects |
|---|---|
| An authenticated session survives a reload | Token persistence — the top post-login regression. Asserts the dashboard still renders, not merely that the URL held. |
| The dashboard exposes the primary navigation | A cheap structural check that the landing surface is actually the dashboard. |

## How the account problem is solved

Login needs an account, and committing credentials is not an option. So the
suite resolves one in a `setup` project that every other spec depends on:

1. **`SB_EMAIL` / `SB_PASSWORD` in `.env`** — used when present. A stable
   account keeps the login specs fast and independent of signup health.
2. **Otherwise, mint one** — the setup project runs the real signup flow and
   persists the credentials to a gitignored file the login specs read.

Tier 2 is what makes a cold clone work with zero configuration, and it means
the signup flow is exercised on every run rather than only when its own spec
runs. CI deliberately runs with the variables unset so tier 2 stays covered.

---

## What the environment turned out to be like

These are findings from walking the live application, not assumptions. Each one
changed the suite.

**No email confirmation.** Signup moves straight into an in-app questionnaire.
Reaching the dashboard needs no mailbox access at all, so the suite carries no
IMAP dependency and no inbox-polling helper.

**Login does not land on the dashboard.** It lands on
`/login/mfa-promote`, an MFA promotion screen that must be declined first. The
suite asserts that screen explicitly rather than clicking through it — if it
disappeared, the login journey would have changed shape and a test should say
so.

**Signup's dashboard opens behind a first-run dialog,** and which modal appears
varies between runs (`modal:onboarding-welcome`, `modal:highlights`), sometimes
with a `?campaign=` query appended. The signup URL assertion therefore requires
that *a* modal auxiliary route is present without pinning its name. An earlier
version pinned `modal:highlights` and failed on a product behaviour that was
never under test.

**The demo environment serves a private-CA certificate** — issuer
`DifferentLab TLS CA (sales)`, with a ~24-hour validity window — which Chromium
rejects as `ERR_CERT_AUTHORITY_INVALID`. The suite sets
`ignoreHTTPSErrors: true`. That is the correct call for a sandbox, and it is
called out here rather than buried in config, because on a production target the
same setting would be hiding a real defect.

**Third-party scripts are unreachable in the sandbox.** Google Tag Manager,
HubSpot, Hotjar, Sentry and RudderStack all fail to load and produce console
errors on every page. Any console-error assertion would need to allow-list them,
which is why the suite has none.

**reCAPTCHA is active on the signup form.** It is score-based and never
escalated to an interactive challenge across dozens of automated signups. If it
ever did, that flow would become untestable by design — the right response is a
loud failure and a conversation about a test-mode key, not a workaround.

**The backend is intermittently slow on the account-creating call.** The final
questionnaire step fires `POST /api/signup`, and on a shared demo box that call
occasionally hangs or returns a gateway error (502/504 — see the adversarial
findings). That is why `playwright.config.ts` configures retries (1 locally, 2
in CI) and why the signup flow gives that one transition a 60s budget. Two
things worth separating: the *test-side* races — clicks and fills lost to the
Angular questionnaire re-rendering each step — are fixed deterministically
(every input is re-applied until it lands, verified across a 12× `--retries=0`
stress run with zero input failures); the residual is purely the backend
transient, which no test can fix and which a retry absorbs. If you ever see a
run marked *flaky*, that is the environment, not a race.

---

## Defects found while building this

Three confirmed defects, each reproduced at least twice before being written
down. Two carry failing tests; the third is reported without one, for the
reason given below.

**Screen recordings and screenshots for each are in
[`defect-evidence/`](defect-evidence/)** — MP4 of the full reproduction plus the
failure screenshot, one pair per defect. Regenerate them any time with
`npm run evidence`, which runs only the `@known-defect` tests with video and
tracing on and converts the output to MP4.

### 1. An unrecognised modal route blanks the application

Navigating to `/dashboard/my-overview(modal:<anything-unrecognised>)` makes the
Angular Router raise `NG04002` ("cannot match any routes"). The URL collapses
to `/` and the page renders **completely empty** — `document.body.innerText`
is zero characters. No message, no navigation, no way back. Reproduced three
times, authenticated and not; auth state is irrelevant.

This is not just a malformed-URL curiosity. The signup flow itself lands on
`(modal:onboarding-welcome)` and `(modal:highlights)`, so these auxiliary
routes reach real browser history and real bookmarks. Rename or retire a modal
and every stored link to it becomes a blank white screen.

Covered by `tests/e2e/router-malformed-modal.spec.ts` (fails).

### 2. Signup accepts a duplicate email, then rejects the password it accepted

Reproduced on the demo environment on 2026-08-12:

1. Register with an email address that already has an account. The form
   accepts it — no "already in use" error, on the form or anywhere later.
2. The flow continues into the questionnaire and setup wizard exactly like a
   genuine registration, and reaches the dashboard.
3. The password chosen during that second registration is then **rejected at
   login**.
4. The original account's password still works.

So a user who has forgotten they already signed up will re-register, choose a
new password, complete all eight questionnaire steps and the setup wizard —
and then be unable to log in with the password they just set, with nothing
having told them anything went wrong.

### These two tests fail on purpose

`tests/e2e/signup-duplicate-email.spec.ts` **fails**, and that is the intended
state. The two tests describe how the product should behave; it does not
behave that way, so the suite says so.

```
✘ registering an already-used email surfaces a conflict message
    expect(locator).toContainText(/already (registered|in use|exists)/i) failed

✘ a password set during a duplicate registration works at login
    TimeoutError: page.waitForURL: Timeout 20000ms exceeded
```

They were not weakened into passing. Rewriting them to assert the buggy
behaviour, or marking them skipped, would make the suite agree with the bug —
at which point it can no longer detect it, and the green run would be a lie.
When the defect is fixed these two become the regression guard with no edit.

To run without them:

```bash
npm run test:no-defects        # or: npx playwright test --grep-invert @known-defect
```

Expected results today: **23 passed, 5 failed** on a full run — the 5 failures
are all `@known-defect` (these two duplicate-email tests, the router blank-page
test, and the two employee-count tests from the adversarial pass below);
**23 passed** with the known-defect tests excluded.

One implementation note, since the first version of this test got it wrong:
it asserts that a conflict message *is present*, not that the questionnaire
*is absent*. An absence check passes vacuously in the moment before the
questionnaire renders — it would have gone green while the defect was live.

### 3. First and last name have no length limit

A 300-character first name is accepted and rendered verbatim into the
questionnaire's "Welcome, &lt;name&gt;." heading, which overflows the viewport with
no wrapping or truncation. Reproduced twice.

Reported without a test on purpose. Asserting "the layout is broken" needs a
visual-regression baseline, and this environment has none — the trial banner
counts down daily and the first-run modal varies between runs, so a snapshot
would be noise. The fix is a `maxlength` on the input and truncation in the
heading; a meaningful test comes after that, not before.

### Also observed, not defects

Worth knowing, and recorded in `tests/e2e/docs/app-context.md`:

- The signup questionnaire keeps **no durable state** — navigating away and
  back, or using browser Back/Forward, discards every answer and returns to
  registration step 1. The in-app `Back` button does preserve answers. Defensible
  as designed, but a long questionnaire with no resume is a conversion risk.
- **Onboarding completion is unenforced** — the dashboard is reachable without
  ever visiting `/onboarding`.
- **Concurrent sessions are allowed**, and logging out of one leaves the other
  authenticated.
- **A stale session is handled well**: deleting the cookie mid-session and
  triggering an API call redirects cleanly to `/login` rather than hanging or
  blanking.
- **Signup's validation messaging is inconsistent**, both internally and against
  login's. On an empty submit all six required fields get `aria-invalid="true"`,
  but what the user is *told* varies per field: phone gets inline text, email
  says nothing until submission is attempted (not on blur, and nothing at all on
  an empty submit), first name / last name / terms get invalid styling with no
  message, and password has no text message at all — it renders a live
  five-item requirement checklist instead. Login, by contrast, says "Email is
  required" / "Password is required" outright. The attribute is the only
  reliable signal across all six, which is why the specs assert on it rather
  than on message text.

## Adversarial findings from a dedicated probing pass

After the functional suite was green, both flows went through a focused
adversarial pass aimed at the surface ordinary testing skips — API-level
gate bypass, injection, boundary values, rate limiting, timing side-channels.
Every finding below was reproduced at least twice, then handed to a separate
reviewer whose only job was to *disprove* it; these seven are the ones that
survived. None was refuted. Full reproduction steps are in
[`tests/e2e/docs/adversarial-findings.md`](tests/e2e/docs/adversarial-findings.md).

The headline is worth stating first:

**Terms and Data-Processing-Agreement acceptance is enforced only in the
browser.** `POST /api/signup` accepts a fully valid payload with
`accept_conditions: false` and returns HTTP 200, creating a real, usable
account — the required consent checkbox has no server-side counterpart. On a
workforce-management platform that will go on to process employees' personal
data, an account created with a false record of DPA acceptance is a genuine
compliance concern. It was reproduced from two fresh anonymous sessions, each
with a legitimately obtained reCAPTCHA token, followed by a successful login.

I deliberately did **not** write a regression test for it. A test would replay
the exploit on every CI run — repeatedly creating accounts that falsely record
consent, against a shared demo environment. Automating a compliance bypass so
it fires on every push is the wrong thing to ship; the finding belongs in a
report, and the fix belongs server-side.

The rest, by severity after independent review:

| Finding | Severity | Automated? |
|---|---|---|
| Terms/DPA enforced client-side only (API accepts `accept_conditions: false`) | high | Reported — see above |
| No rate limiting or lockout on `POST /api/auth/login` (yet forgot-password *does* rate-limit) | high | Reported — a test would hammer a shared box |
| Login timing side-channel re-opens account enumeration despite identical error copy | medium | Reported — timing assertions rot |
| Gateway errors (502/504) shown to the user as "Email or password is incorrect." | medium | Reported — can't trigger a 502 on demand |
| Forgot-password rate-limit shown as a generic "Something went wrong" | medium | Reported — needs to trip a real rate limit |
| "Number of employees" accepts decimals and unbounded integers | medium | **Yes** — `signup-employee-count.spec.ts` |
| Questionnaire step 2 has no Back button, unlike every other step | low | Reported — a minor UX inconsistency |

One became a test; the other six are reported, and that split is the honest
outcome rather than a thin one. Most of these are not things a *portable* suite
should assert: an on-demand gateway error, a destructive rate-limit probe, a
wall-clock timing threshold, or an exploit that shouldn't run on every CI
trigger each make a worse test than a clear report. The one that is clean,
deterministic, and side-effect-free became a `@known-defect` test — the
employee-count field accepting `3.33` (a client-side assertion that creates no
account), built to fail deterministically on the *defect* itself, not on a
fragile handshake.

## Selector strategy

Locators live in `tests/e2e/page-repository.json`, one entry per element,
referenced from specs by name.

The questionnaire's radio and checkbox inputs carry `class="peer sr-only"` —
they are visually hidden and genuinely unclickable; the `<label>` is the real
control. Rather than clicking labels by their visible text, options are targeted
through the hidden input's stable `value` attribute and clicked via the
associated label:

```json
{ "css": "[formcontrolname='pain'] input[value='pain_scheduling_takes_too_much_time'] + label" }
```

This matters because the values and the visible copy disagree — the option
rendered as "Scheduler" has value `Planner`, and "Human Resources" has value
`HR`. Targeting the copy would tie the suite to marketing text that changes
without notice.

---

## Deliberately not covered

Stated so the omissions read as decisions rather than gaps:

- **Everything past the dashboard.** The brief scopes the flow to the moment
  the dashboard is reached; scheduling, timesheets, absence and payroll are out.
- **Password reset.** Reachable from `/login/forgot`, but outside both named
  flows.
- **An exhaustive field-validation matrix.** One representative case per
  validation class instead of every field × every rule.
- **Cross-browser.** Chromium only. The config takes a browser matrix in one
  line; on a shared demo environment three browsers buy little for the runtime.
- **Visual regression.** No stable baseline story on an environment that resets
  and whose trial banner counts down.
- **A full mobile walk of the questionnaire.** The mobile project checks the
  registration form only. Re-walking eight questionnaire steps on a second
  device profile would roughly double the suite's runtime to re-prove logic
  the desktop run already covers.
- **Load and performance.** Out of scope for a functional brief, and impolite
  on someone else's demo box.

---

## What I would do next

- **Raise the Terms/DPA server-side-enforcement finding first.** It is the one
  finding with legal weight, and the fix is small: reject
  `accept_conditions: false` at `/api/signup` rather than trusting the form.
  Everything else on this list is engineering hygiene; this one is a
  compliance control that currently does not exist where it matters.
- **Move signup setup to the API.** The questionnaire is eight UI steps that the
  login specs do not care about. Minting accounts through the signup endpoint
  would cut most of the suite's runtime and leave the UI walk to the one spec
  whose subject it actually is.
- **Ask for a reCAPTCHA test key** for the target environment, so the signup
  flow cannot start failing for reasons unrelated to the product.
- **Ask whether the private-CA certificate is intentional.** If the demo
  environment is meant to be publicly reachable, a 24-hour cert from an internal
  CA is worth a conversation — and would let `ignoreHTTPSErrors` be removed.
- **Add data cleanup.** Every run leaves a trial account behind on a shared
  environment. With an API or admin affordance, accounts should be torn down.
- **Cover password reset and logout** once the scope extends past the two named
  flows.
