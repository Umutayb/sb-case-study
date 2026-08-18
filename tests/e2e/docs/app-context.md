# App context — Shiftbase demo environment

Living knowledge base for the application under test. Written during Phase-2
groundwork by walking the live environment; updated whenever a later phase
discovers something new.

**Environment:** `https://app.sb036c506.demo.shiftbase.co`
**Stack:** Angular SPA (bundle `main-*.js`), REST API under `/api/`.
**Scope under test:** signup + onboarding up to the dashboard, and login.
Everything the product offers past the dashboard is out of scope.

## Environment characteristics that affect the suite

- **Private-CA TLS.** The host serves a certificate issued by
  `DifferentLab TLS CA (sales)` with a ~24h validity window, not a publicly
  trusted CA. Chromium rejects it with `ERR_CERT_AUTHORITY_INVALID`, so the
  suite sets `ignoreHTTPSErrors: true`. This is a property of the demo
  environment, not something the tests should paper over silently — it is
  called out in the README.
- **Third-party scripts are unreachable.** Google Tag Manager, HubSpot,
  Hotjar, Sentry and RudderStack all fail with `ERR_CONNECTION_REFUSED` in
  this sandbox. They produce console errors on every page. Any console-error
  assertion has to allow-list these or it will fail permanently.
- **reCAPTCHA is present on the signup form** ("This site is protected by
  reCAPTCHA"). It is score-based rather than a challenge — automated signups
  completed without ever being presented with a puzzle. If it ever escalates
  to an interactive challenge, that flow becomes untestable by design and the
  spec should fail loudly rather than attempt to solve it.
- **No email confirmation.** Signup transitions straight into the in-app
  questionnaire. No mailbox access is needed to reach the dashboard, which is
  why the suite carries no IMAP dependency.

## SignupPage — `/signup`

**Purpose:** Trial registration, then an in-app questionnaire that profiles
the business. The URL stays `/signup` for every questionnaire step.

**Fields (registration step):** First name, Last name, Your business email,
Your mobile number (with a `+31` country-code button), Password (with a
"Show password" toggle).

**Actions:** "I accept the terms and the processing agreement." checkbox
(required), a marketing opt-in checkbox (optional), "Get started" button, and
a "Log in" link to `/login`.

**Questionnaire steps, in order:**

1. Business name, Number of employees, Country (defaults to Netherlands).
2. "What best describes your business?" — selecting a business type
   progressively reveals "In which industry?", which in turn reveals
   "And what's your role?". `Next` stays disabled until all three are set.
3. "What do you need Shiftbase to handle?" — multi-select checkboxes.
4. "What are you using now?" — single select.
5. "Pick what's most painful right now." — single select.
6. "What's this problem costing you right now?" — **multi-select**, despite
   reading like the single-select steps around it.
7. "What's the main reason you're looking for a solution right now?" — single select.
8. "When would you like this sorted out?" — single select.

**States:** `Next` is disabled until the step's required inputs are set. Every
questionnaire step also carries a `Back` button, so the wizard is navigable in
both directions. Radio inputs do not respond to a click on the input itself —
they are `class="peer sr-only"`, and the clickable target is the adjacent
label element.

**Client-side validation (confirmed live, 2026-08-12):** all six required
registration fields (`First name`, `Last name`, email, phone, password,
terms checkbox) get a real `aria-invalid="true"` attribute when invalid —
reliably assertable via `steps.verifyAttribute(el, 'SignupPage',
'aria-invalid', 'true')`. Inline error *text* is much sparser than the
attribute-level marking:
- Phone gets "Telephone number is invalid" as soon as an invalid value is
  present (empty or non-numeric alike).
- Email only shows "Invalid email" once submission is attempted (not on
  blur), and does not show anything on a merely-empty submit — so an empty
  submit produces phone's inline text but not email's.
- First name, last name, and the terms checkbox get invalid styling with no
  message at all.
- Password never gets a plain-text message; instead a live 5-item
  requirement checklist (`sb-password-input-requirements`) renders one
  `sb-icon` per requirement — `aria-label="exclamation-circle"` for unmet,
  `aria-label="check"` for met. Selector added to the repository as
  `passwordUnmetRequirement` (`sb-password-input-requirements
  sb-icon[aria-label='exclamation-circle']`) for counting unmet items.

All five scenarios block submission client-side — the URL and the
registration heading stay put, the questionnaire never renders. Covered by
`tests/e2e/signup-validation.spec.ts`.

**Known defect — email uniqueness is not enforced.** Registering with an email
that already has an account is accepted with no conflict error, proceeds
through the entire questionnaire and wizard, and reaches the dashboard. The
password chosen during that second registration is then rejected at login,
while the original account's password continues to work. Covered by
`tests/e2e/signup-duplicate-email.spec.ts`, which is tagged `@known-defect`
and **fails on purpose** — it describes the behaviour the product should have,
so it becomes the regression guard unchanged once the defect is fixed.

**Navigation:** Reached from `/login`; hands off to `/onboarding`.

## OnboardingPage — `/onboarding`

**Purpose:** Post-registration setup wizard.

**Steps:** three data steps then a completion screen.

1. **Teams** — "Organise your teams for smarter scheduling". One row
   pre-filled with the *business name* from the questionnaire (not a generic
   default). `Add team` appends an empty row; each row past the first gets an
   enabled delete button, the sole row's is disabled.
2. **Employees** — "Great! Now let's add your first employees." One row
   pre-filled with the registering user's first/last name and a `Team`
   `<select>` whose options are exactly the teams from step 1 — a team added
   there is selectable here, which is the wizard's one observable cross-step
   effect. `Add employee` appends a row.
3. **Shift templates** — "Almost there! Let's set up your Shift templates."
   One row pre-filled `Day shift` / `09:00` / `17:30`. `Add Shift template`
   appends a row.
4. **Completion** — "🎉 You're all set, &lt;first name&gt;!" with a single
   "See Shiftbase in action!" button. No progress bar on this screen.

**Actions:** Each data step offers `Next` and `Skip`; both advance. Skipping
all three still reaches the completion screen.

**Progress bar:** shared with the signup questionnaire, so it reports
progress through the whole registration journey rather than through the
wizard alone — `aria-valuenow` is 83.33 on the employees step and 91.67 on
the shift-templates step.

**States:** No completion gate and no memory. Re-entering `/onboarding` on an
account that already finished it restarts at the teams step with the same
pre-filled business name, and abandoning the wizard mid-way does not block
`/dashboard/my-overview`.

**Navigation:** Reached from `/signup`; hands off to
`/dashboard/my-overview(modal:highlights)`.

## LoginPage — `/login`

**Purpose:** Authentication.

**Fields:** Email address, Password (with a "Show password" toggle).

**Actions:** "Keep me logged in" checkbox, "Log in" button, "Forgot
password?" link to `/login/forgot`.

**States:**
- Empty submit → inline field errors "Email is required" and "Password is
  required"; both inputs get `[invalid]`.
- Bad credentials → an `alert` region reading "Unable to log you in with the
  supplied credentials". The message is identical for a wrong password and an
  unknown email, so it does not leak account existence — worth an explicit
  assertion.

**Navigation:** Successful login goes to `/login/mfa-promote`, not straight
to the dashboard.

## MfaPromotePage — `/login/mfa-promote`

**Purpose:** Encourages enabling multifactor authentication after login. It
is a promotion, not a requirement.

**Actions:** "Set up now", "Remind me later", "Don't ask again", and a "Back
to login" button.

**Navigation:** "Remind me later" proceeds to `/dashboard/my-overview`.

**Note for tests:** this screen sits between login and the dashboard, so any
"log in and land on the dashboard" assertion has to pass through it.

**Branch behaviour (mapped in Phase 4):**
- "Set up now" → `/login/mfa-setup`, a full TOTP enrolment screen (QR code,
  secret, password and code fields) with a "Skip for now" escape hatch.
- "Remind me later" → dashboard; the prompt returns on the next login.
- "Don't ask again" → dashboard, and the prompt is durably suppressed for that
  account on all future logins.
- **"Back to login" terminates the session** rather than navigating back — it
  is a logout in disguise, which is worth knowing before writing a test that
  treats it as a passive back-link.

## ForgotPasswordPage — `/login/forgot`

**Purpose:** Password recovery request.

**Behaviour:** Returns the same "Check your email" confirmation for a
registered address and an unknown one, so like the login form it does not leak
account existence. Out of scope for this suite (outside both named flows), but
mapped for completeness.

## Other routes observed

- `/logout` — ends the session.
- `/dashboard/my-schedule`, `/dashboard/my-hours`, `/dashboard/my-absence`,
  `/dashboard/my-plus-minus` — the "My items" sub-pages of the dashboard.
- Primary navigation leads to `/schedule/...`, `/timesheet/...`, `/employees`,
  `/reports`, `/insights`, `/communications` — all out of scope per the brief.

**Route guarding works in both directions:** unauthenticated requests to
`/dashboard/my-overview` and `/login/mfa-promote` redirect to `/login`, and an
already-authenticated session requesting `/signup` or `/login` is redirected to
the dashboard.

## DashboardPage — `/dashboard/my-overview`

**Purpose:** The landing surface that completes both flows under test.

**Sections:** Left navigation (Home, Communications, Schedule, Timesheet,
Performance, Employees, Reports, My items) and overview cards including "My
schedule" and "My timesheets". A trial banner reads "Your trial ends in 14
days".

**States:** Immediately after signup the URL carries a `(modal:highlights)`
auxiliary route; after a plain login it does not. Assertions should match the
path prefix rather than the full URL.

**Navigation:** Reached from `/onboarding` (signup flow) and from
`/login/mfa-promote` (login flow).

**First-run coach mark:** arriving from signup with `?campaign=new-nav` also
opens a "New navigation" popover in a `.cdk-overlay-pane`, positioned over
the left of the page. It overlaps the guided-checklist panel and swallows
clicks aimed at it, so anything driving the checklist has to dismiss the
popover ("Got it!") first. It does not appear on a plain login.

## Guided checklist ("Get started") — on `/dashboard/my-overview`

**Purpose:** A seven-task onboarding checklist that persists after the
`/onboarding` wizard finishes. It renders twice, from the same state:

- `my-checklist-widget` — a card on the dashboard itself.
- `checklist-panel` — a side panel opened by the sidebar "Get started" entry
  (which carries its own progress bar) and closed by the panel's "Close"
  button. Closing removes the panel from the DOM.

**Tasks (fixed order):** 1. Account created · 2. Add your first shift ·
3. Optimise your schedule · 4. Track employee hours · 5. Manage employee
absences · 6. Invite your team · 7. Download mobile app.

**Data fields:** each task is an `sb-checklist-item` carrying
`aria-expanded`; its status icon is `sb-icon[aria-label='check-circle-solid']`
when complete and `sb-icon[aria-label='circle']` when not. A fresh account has
task 1 complete and the progress bar reads `14%`, above the line "Great job –
You've got this &lt;first name&gt;! 🚀".

**Actions:**
- Clicking a task header expands it, revealing a one-line description and a
  `Start` button (tasks 3–5 also offer `Show me`). It is a one-at-a-time
  accordion: opening another task collapses the current one, and clicking the
  open task again does *not* collapse it.
- `Start` on "Add your first shift" routes to
  `/schedule/employee/week;onboardingStep=SCHEDULE_SHIFT` and opens a guided
  overlay.
- `Dismiss checklist` (present in both the widget and the panel) removes the
  widget *and* the sidebar "Get started" entry with no confirmation, and the
  dismissal is account-level — it survives a reload.

**States:** progress is account state, not session state; it survives a full
page load and a fresh login.

**Note for tests:** anything that dismisses the checklist burns the account
for every later checklist assertion, so a spec that dismisses has to own a
freshly minted account and run after the read-only ones.
