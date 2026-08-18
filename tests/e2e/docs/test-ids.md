# Test IDs

Every test carries a stable ID as the first token of its title
(`LGN-01 · valid credentials reach the dashboard`). The IDs are the handle for
targeted runs, for referring to a scenario in a bug report or a review, and for
pointing at a case without quoting its whole sentence.

Prefixes: `SETUP` account resolution · `SGN` signup and onboarding
(`j-signup-onboard`) · `ONB` the `/onboarding` wizard (`j-onboarding-wizard`) ·
`CHK` the guided checklist surface (`j-guided-checklist`) · `TSK` the guided
checklist's tasks · `LGN` login (`j-login`) · `SES` post-login session ·
`RTR` router edges.

IDs are stable. A retired test keeps its ID retired rather than recycling it, so
an ID in an old report never points at a different scenario later.

## Running by ID

```bash
SLOW_MO=1200 npm run test:id -- "LGN-04"             # one case, watched
SLOW_MO=1200 npm run test:id -- "LGN-0(1|2|4)"       # several — grep is a regex
SLOW_MO=1200 npm run test:id -- "LGN-04" --no-deps   # skip the setup project
npx playwright test --grep "SGN-04"                  # headless, no pacing
```

`test:id` is `playwright test --headed --grep`, so the run is headed, single-worker
and paced by `SLOW_MO` (default 1000ms per action).

Two things worth knowing:

- **The `setup` project always runs first**, whatever the grep — Playwright does not
  filter dependency projects. That is usually what you want (login cases need a
  resolved account), but without `SB_EMAIL`/`SB_PASSWORD` in `.env` it mints one
  through the real signup flow first, which can take a couple of minutes before the
  case you asked for starts. `--no-deps` skips it and reuses whatever
  `tests/e2e/.auth/account.json` already holds.
- **Mobile cases** (`SGN-02`, `LGN-10`) only exist in the `mobile` project. Grepping
  them alone is fine; adding `--project=chromium` filters them out entirely.

## Index

| ID | Spec | Project | Test |
|---|---|---|---|
| `SETUP-01` | `setup/account.setup.ts` | setup | resolve an account for the login specs |
| `SGN-01` | `signup/signup.spec.ts` | chromium | a new trial account reaches the dashboard |
| `SGN-02` | `signup/signup.spec.ts` | mobile | the registration form is usable on a mobile viewport `@mobile` |
| `SGN-03` | `signup/signup.spec.ts` | chromium | the registration form hands off to the questionnaire |
| `SGN-04` | `signup/signup-validation.spec.ts` | chromium | submitting the form empty blocks submission and marks every required field invalid |
| `SGN-05` | `signup/signup-validation.spec.ts` | chromium | an invalid email format is rejected with an inline "Invalid email" message |
| `SGN-06` | `signup/signup-validation.spec.ts` | chromium | a non-numeric phone number is rejected with an inline "Telephone number is invalid" message |
| `SGN-07` | `signup/signup-validation.spec.ts` | chromium | a weak password leaves the requirement checklist unmet and blocks submission |
| `SGN-08` | `signup/signup-validation.spec.ts` | chromium | an unticked terms checkbox blocks submission |
| `SGN-09` | `signup/signup-persistence.spec.ts` | chromium | leaving the signup flow and returning discards questionnaire progress |
| `SGN-10` | `signup/signup-duplicate-email.spec.ts` | chromium | registering an already-used email surfaces a conflict message `@known-defect` |
| `SGN-11` | `signup/signup-duplicate-email.spec.ts` | chromium | a password set during a duplicate registration works at login `@known-defect` |
| `SGN-12` | `signup/signup-employee-count.spec.ts` | chromium | a decimal employee count does not block the Next button `@known-defect` |
| `SGN-13` | `signup/signup-employee-count.spec.ts` | chromium | an unbounded employee count does not block the Next button `@known-defect` |
| `ONB-01` | `onboarding/wizard.spec.ts` | chromium | the wizard walks teams, employees and shift templates to the completion screen |
| `ONB-02` | `onboarding/wizard.spec.ts` | chromium | a team added in the teams step is selectable against an employee |
| `ONB-03` | `onboarding/wizard.spec.ts` | chromium | skipping every step still reaches the completion screen |
| `ONB-04` | `onboarding/wizard.spec.ts` | chromium | re-entering the wizard after finishing it starts over from the teams step |
| `ONB-05` | `onboarding/wizard.spec.ts` | chromium | abandoning the wizard part-way still leaves the dashboard reachable |
| `CHK-01` | `onboarding/checklist.spec.ts` | chromium | a new account lands with one of seven tasks done |
| `CHK-02` | `onboarding/checklist.spec.ts` | chromium | expanding a task reveals its call to action and collapses the previous one |
| `CHK-03` | `onboarding/checklist.spec.ts` | chromium | completing a task ticks it off and moves the progress readout |
| `CHK-04` | `onboarding/checklist.spec.ts` | chromium | dismissing the checklist removes it for good |
| `TSK-01` | `onboarding/checklist-tasks.spec.ts` | chromium | dragging a shift template onto the schedule completes "Add your first shift" |
| `TSK-02` | `onboarding/checklist-tasks.spec.ts` | chromium | "Optimise your schedule" enables the scheduling defaults |
| `TSK-03` | `onboarding/checklist-tasks.spec.ts` | chromium | "Track employee hours" opens the time-tracking setup and unblocks on a choice |
| `TSK-04` | `onboarding/checklist-tasks.spec.ts` | chromium | taking the absence tour completes "Manage employee absences" |
| `TSK-05` | `onboarding/checklist-tasks.spec.ts` | chromium | every task that stays incomplete keeps its call to action |
| `TSK-06` | `onboarding/checklist-tasks.spec.ts` | chromium | "Invite your team" opens an invite dialog `@known-defect` |
| `LGN-01` | `login/login.spec.ts` | chromium | valid credentials reach the dashboard |
| `LGN-02` | `login/login.spec.ts` | chromium | login is offered multifactor authentication before the dashboard |
| `LGN-03` | `login/login-negative.spec.ts` | chromium | submitting an empty form reports both required fields |
| `LGN-04` | `login/login-negative.spec.ts` | chromium | a wrong password is rejected |
| `LGN-05` | `login/login-negative.spec.ts` | chromium | an unknown email is rejected |
| `LGN-06` | `login/login-negative.spec.ts` | chromium | rejection does not reveal whether the account exists |
| `LGN-07` | `login/login-negative.spec.ts` | chromium | a logged-out visitor cannot reach the dashboard directly |
| `LGN-08` | `login/login-rate-limit.spec.ts` | chromium | repeated failed logins are eventually throttled or locked out `@known-defect` |
| `LGN-09` | `login/login-session-edges.spec.ts` | chromium | "Back to login" on the MFA prompt silently terminates the session |
| `LGN-10` | `login/login-session-edges.spec.ts` | mobile | the login form is usable on a mobile viewport `@mobile` |
| `LGN-11` | `login/login-session-edges.spec.ts` | chromium | logging out of one session does not affect a concurrent session for the same account |
| `LGN-12` | `login/login-session-edges.spec.ts` | chromium | a session invalidated mid-interaction redirects to login instead of hanging or blanking |
| `SES-01` | `edge/session.spec.ts` | chromium | an authenticated session survives a reload |
| `SES-02` | `edge/session.spec.ts` | chromium | the dashboard exposes the primary navigation |
| `RTR-01` | `edge/router-malformed-modal.spec.ts` | chromium | an unknown modal auxiliary route does not blank the page `@known-defect` |
