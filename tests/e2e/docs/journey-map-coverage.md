# Journey Map — Coverage

Companion to `tests/e2e/docs/journey-map.md`. Maps every authored journey
(and sub-journey) to the spec file(s) and test title(s) that cover each of
its authored `Test expectations` / supporting assertions, or `<missing>`
where no spec exists yet. Two journeys, both P0: j-signup-onboard, j-login.

**Suite snapshot:** 18 passing tests across `signup.spec.ts`,
`signup-validation.spec.ts`, `login.spec.ts`, `login-negative.spec.ts`,
`session.spec.ts`; 3 tests failing on purpose (`@known-defect`) in
`signup-duplicate-email.spec.ts` and `router-malformed-modal.spec.ts`,
tracking confirmed product defects.

## j-signup-onboard

| Expectation | Spec / test | Status |
|---|---|---|
| Full journey test (entry → exit) | `signup.spec.ts` › "a new trial account reaches the dashboard" | Covered |
| Supporting: registration → questionnaire handoff | `signup.spec.ts` › "the registration form hands off to the questionnaire" | Covered |
| Mobile: yes (registration form) | `signup.spec.ts` › "the registration form is usable on a mobile viewport `@mobile`" | Covered |
| Error state — duplicate email accepted silently (defect) | `signup-duplicate-email.spec.ts` › both tests (`@known-defect`, fail on purpose) | Covered (defect-tracking) |
| Error state — malformed dashboard modal aux-route blanks the page (defect) | `router-malformed-modal.spec.ts` › "an unknown modal auxiliary route does not blank the page" (`@known-defect`, fails on purpose) | Covered (defect-tracking) |
| Error state — empty submit / invalid email / invalid phone / weak password / unticked terms | `signup-validation.spec.ts` › all 5 tests | Covered |
| Edge case — 300-char first name, no length cap, breaks questionnaire heading layout (defect) | — | `<missing>` |
| Edge case — wizard progress lost on browser back/forward or direct URL revisit, no warning/resume (defect) | — | `<missing>` |
| Edge case — whitespace-padded name fields silently accepted (minor, unconfirmed) | — | `<missing>` |
| Performance baseline | — | `<missing>` |

**Journey coverage: 6/10 authored expectations covered.**

## j-login

| Expectation | Spec / test | Status |
|---|---|---|
| Full journey test (entry → exit, incl. MFA-promote interstitial) | `login.spec.ts` › "valid credentials reach the dashboard" + "login is offered multifactor authentication before the dashboard" | Covered |
| Error state — empty submit | `login-negative.spec.ts` › "submitting an empty form reports both required fields" | Covered |
| Error state — wrong password | `login-negative.spec.ts` › "a wrong password is rejected" | Covered |
| Error state — unknown email | `login-negative.spec.ts` › "an unknown email is rejected" | Covered |
| Error state — non-enumeration (identical message) | `login-negative.spec.ts` › "rejection does not reveal whether the account exists" | Covered |
| Error state — logged-out direct dashboard access redirects | `login-negative.spec.ts` › "a logged-out visitor cannot reach the dashboard directly" | Covered |
| Supporting: session survives reload | `session.spec.ts` › "an authenticated session survives a reload" | Covered |
| Supporting: primary navigation present post-login | `session.spec.ts` › "the dashboard exposes the primary navigation" | Covered |
| Error state — MFA "Set up now" wrong-code alert | — | `<missing>` |
| Error state — "Back to login" silently terminates the session | — | `<missing>` |
| Edge case — concurrent sessions permitted | — | `<missing>` |
| Edge case — stale/cookie-invalidated session redirects gracefully mid-interaction | — | `<missing>` |
| Edge case — MFA-promote reachable via direct nav mid-session | — | `<missing>` |
| Mobile: yes (login form) | — | `<missing>` |
| Performance baseline | — | `<missing>` |

**Journey coverage: 8/15 authored expectations covered.**

*Note: the malformed-dashboard-modal defect (j-signup-onboard's Edge case) is auth-state-independent and was confirmed to reproduce on an authenticated session reached via login too. `router-malformed-modal.spec.ts` covers it once; no separate login-specific repro is listed as missing here.*

## sj-dash-landing

No standalone spec, and none is expected — this sub-journey is exercised
implicitly inside both parents' full-journey tests: `signup.spec.ts`
dismisses the first-run dialog and verifies the landing widgets;
`login.spec.ts` and `session.spec.ts` verify the landing widgets directly
(no modal on that arrival path). Folding it into the parents' tests rather
than dispatching it separately is correct per the journey map's Phase 3.5
revision log — it is not a `<missing>` gap.

## Out of scope (explicitly not coverage gaps)

Per the assignment brief: *"Reaching the dashboard means the flow is
complete. Anything the product asks you to set up after that point is out
of scope."* The following are recorded for completeness only and must not
be read as deficient coverage:

- **Past-the-dashboard sections:** `scheduling` (`/schedule/*`), `timesheet`
  (`/timesheet/*`), `communications`, `employees`, `analytics` (`/insights`),
  `reports`, `settings` (`/account/settings`), `profile`
  (`/my-account/profile`, `/my-account/files`), `notifications`
  (`/my-account/notifications`), `billing` (dashboard subscription modal).
- **Adjacent flows not named in the brief:** `/login/forgot` (password
  recovery) and `/logout` (session termination) — reachable from the two
  named flows' pages but not literally "signup + onboarding to dashboard"
  or "login".

None of the above appear as `<missing>` above and none should be added to a
future coverage-expansion backlog for this project.

## Summary

| Journey | Priority | Expectations authored | Covered | Missing |
|---|---|---|---|---|
| j-signup-onboard | P0 | 10 | 6 | 4 |
| j-login | P0 | 15 | 8 | 7 |

14/25 authored expectations covered across the two in-scope P0 journeys.
The remaining 11 gaps are itemized in `journey-map.md`'s `## Coverage Plan`
— not a full re-composition, since both journeys' core happy paths and most
error states are already built and passing.
