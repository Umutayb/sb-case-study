import { expect, test } from '../fixtures/base';
import { buildUser, Routes, TestUser, UrlPattern } from '../data/test-data';
import { submitRegistrationForm, completeQuestionnaire } from '../flows/signup-flow';
import { logInToDashboard } from '../flows/login-flow';
import { addTeam, advance, enterWizard, waitForCompletionScreen } from '../flows/onboarding-flow';

const ONBOARDING = 'OnboardingPage';
const DASHBOARD = 'DashboardPage';

/**
 * `/onboarding` as a journey in its own right.
 *
 * `signup.spec.ts` proves the wizard can be got past on the way to the
 * dashboard. These specs are about the wizard itself: that each step is the
 * step it claims to be, that the one piece of data flowing between steps
 * actually flows, and that the two documented absences — no completion gate,
 * no memory — are still true.
 *
 * Serial, and minting a single account in the first test, because the
 * questionnaire in front of the wizard costs about two minutes. Re-minting per
 * scenario would spend half an hour re-proving `SGN-01`. Later scenarios log
 * in and re-enter the wizard by direct navigation, which is legitimate
 * precisely because `ONB-04` demonstrates a completed account gets the wizard
 * back from the start.
 */
test.describe('Onboarding wizard', () => {
  test.describe.configure({ mode: 'serial' });

  let user: TestUser;

  test('ONB-01 · the wizard walks teams, employees and shift templates to the completion screen', async ({
    steps,
  }) => {
    test.setTimeout(240_000);
    user = buildUser();

    await submitRegistrationForm(steps, user);
    await completeQuestionnaire(steps, user);
    await steps.waitForState('teamsHeading', ONBOARDING, 'visible', { timeout: 30000 });

    // Step 1 — teams. The row is pre-filled with the business name given to
    // the questionnaire, which is the wizard's only carry-over from signup.
    await steps.verifyInputValue('teamNameInput', ONBOARDING, user.businessName);
    await steps.verifyPresence('addTeamButton', ONBOARDING);
    await advance(steps, 'nextButton');

    // Step 2 — employees, pre-filled with the registering user.
    await steps.waitForState('employeesHeading', ONBOARDING, 'visible', { timeout: 30000 });
    await steps.verifyInputValue('employeeFirstName', ONBOARDING, user.firstName);
    await steps.verifyInputValue('employeeLastName', ONBOARDING, user.lastName);
    // The progress bar is shared with the signup questionnaire, so it reports
    // position in the whole registration journey rather than in the wizard —
    // 10 of 12 here. Asserted because a wizard that gained or lost a step
    // without this moving would mean the two had come apart.
    await steps.expect('progressBar', ONBOARDING).attributes.get('aria-valuenow').toMatch(/^83\.33/);
    await advance(steps, 'nextButton');

    // Step 3 — shift templates, pre-filled with a standard day shift.
    await steps.waitForState('shiftTemplatesHeading', ONBOARDING, 'visible', { timeout: 30000 });
    await steps.verifyInputValue('shiftTemplateName', ONBOARDING, 'Day shift');
    await steps.verifyInputValue('shiftTemplateStart', ONBOARDING, '09:00');
    await steps.verifyInputValue('shiftTemplateEnd', ONBOARDING, '17:30');
    await advance(steps, 'nextButton');

    await waitForCompletionScreen(steps);
  });

  test('ONB-02 · a team added in the teams step is selectable against an employee', async ({
    steps,
  }) => {
    test.setTimeout(180_000);
    const extraTeam = 'QA Night Shift';

    await logInToDashboard(steps, user.email, user.password);
    await enterWizard(steps);

    await addTeam(steps, extraTeam);
    await advance(steps, 'nextButton');
    await steps.waitForState('employeesHeading', ONBOARDING, 'visible', { timeout: 30000 });

    // The wizard's one observable cross-step effect: teams named on step 1
    // become the options an employee can be assigned to on step 2. Asserted on
    // the full option list rather than on presence, so a team going missing
    // fails as loudly as a team appearing twice.
    const teamOptions = await steps.getAll('employeeTeamOption', ONBOARDING);
    expect(teamOptions.map((option) => option.trim())).toEqual([user.businessName, extraTeam]);
  });

  test('ONB-03 · skipping every step still reaches the completion screen', async ({ steps }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await enterWizard(steps);

    await advance(steps, 'skipButton');
    await steps.waitForState('employeesHeading', ONBOARDING, 'visible', { timeout: 30000 });
    await advance(steps, 'skipButton');
    await steps.waitForState('shiftTemplatesHeading', ONBOARDING, 'visible', { timeout: 30000 });
    await advance(steps, 'skipButton');

    await waitForCompletionScreen(steps);
  });

  test('ONB-04 · re-entering the wizard after finishing it starts over from the teams step', async ({
    steps,
  }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await enterWizard(steps);
    await advance(steps, 'skipButton');
    await advance(steps, 'skipButton');
    await advance(steps, 'skipButton');
    await waitForCompletionScreen(steps);
    await steps.click('seeInActionButton', ONBOARDING);
    // Finishing the wizard lands on the `(modal:highlights)` auxiliary route
    // even in a session that started at `/login` — the first-run modal hangs
    // off completing onboarding, not off having just signed up.
    await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_SIGNUP, undefined, { timeout: 45000 });

    // Straight back in, on an account that has now completed the wizard twice.
    await enterWizard(steps);
    await steps.verifyPresence('teamsHeading', ONBOARDING);
    await steps.verifyInputValue('teamNameInput', ONBOARDING, user.businessName);
    // Nothing carried over from the session that just finished — the wizard
    // does not remember it ran, which is what makes ONB-02 and ONB-03 able to
    // re-enter it rather than each minting an account.
    await steps.verifyAbsence('allSetHeading', ONBOARDING);
  });

  test('ONB-05 · abandoning the wizard part-way still leaves the dashboard reachable', async ({
    steps,
  }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await enterWizard(steps);
    await advance(steps, 'nextButton');
    await steps.waitForState('employeesHeading', ONBOARDING, 'visible', { timeout: 30000 });

    // Walk out mid-wizard. There is no completion gate, so the dashboard is
    // expected to render normally rather than bounce back to `/onboarding`.
    await steps.navigateTo(Routes.DASHBOARD, { waitUntil: 'domcontentloaded' });
    await steps.waitForUrl(UrlPattern.DASHBOARD_AFTER_LOGIN, undefined, { timeout: 45000 });
    await steps.verifyPresence('mySchedulePanel', DASHBOARD);
  });
});
