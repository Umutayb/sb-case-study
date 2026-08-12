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

`npm run test:report` opens the HTML report; `npm run test:headed` watches it
run.

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

---

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
- **Load and performance.** Out of scope for a functional brief, and impolite
  on someone else's demo box.

---

## What I would do next

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
