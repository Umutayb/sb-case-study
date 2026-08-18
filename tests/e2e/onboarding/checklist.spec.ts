import { expect, test } from '../fixtures/base';
import { buildUser, ChecklistTasks, Routes, TestUser } from '../data/test-data';
import { signUpToDashboard } from '../flows/signup-flow';
import { logInToDashboard } from '../flows/login-flow';
import {
  clearFirstRunOverlays,
  completeMobileAppTask,
  completedTasks,
  dismissChecklist,
  expandTask,
  expectProgress,
  expectTaskComplete,
  isTaskComplete,
  openDashboardChecklist,
  readProgress,
} from '../flows/checklist-flow';

const CHECKLIST = 'ChecklistPage';

/**
 * The guided "Get started" checklist — its surface and its lifecycle.
 *
 * The tasks' own actions live in `checklist-tasks.spec.ts`; this file is about
 * the checklist as a thing: what a new account sees, how the accordion
 * behaves, that completing a task moves the readout, and that dismissing it
 * sticks.
 *
 * Serial and single-account for two reasons. The cheap one is cost — a
 * signup is about two minutes. The load-bearing one is that dismissal is
 * account-level and permanent: `CHK-04` burns the checklist for good, so it
 * has to run last against an account no other assertion still needs.
 */
test.describe('Guided checklist', () => {
  test.describe.configure({ mode: 'serial' });

  let user: TestUser;

  test('CHK-01 · a new account lands with one of seven tasks done', async ({ steps }) => {
    test.setTimeout(300_000);
    user = buildUser();

    await signUpToDashboard(steps, user);
    await clearFirstRunOverlays(steps);
    await steps.waitForState('widget', CHECKLIST, 'visible', { timeout: 45000 });

    const titles = await steps.getAll('tasks', CHECKLIST, {
      child: { pageName: CHECKLIST, elementName: 'taskTitle' },
    });
    expect(titles.map((title) => title.trim())).toEqual(ChecklistTasks.ALL);

    // Signing up is itself task 1, so a brand-new account is never at zero.
    expect(await completedTasks(steps)).toEqual([ChecklistTasks.ACCOUNT_CREATED]);
    expect(await readProgress(steps)).toBe(ChecklistTasks.PROGRESS_FRESH);
  });

  test('CHK-02 · expanding a task reveals its call to action and collapses the previous one', async ({
    steps,
  }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    await expandTask(steps, ChecklistTasks.FIRST_SHIFT);
    await steps.verifyListedElement('tasks', CHECKLIST, {
      text: ChecklistTasks.FIRST_SHIFT,
      child: { pageName: CHECKLIST, elementName: 'taskDescription' },
      expectedText: 'Simplify scheduling by adding your first shift now',
    });
    await steps.verifyListedElement('tasks', CHECKLIST, {
      text: ChecklistTasks.FIRST_SHIFT,
      child: { pageName: CHECKLIST, elementName: 'taskStartButton' },
      expectedText: 'Start',
    });

    // One at a time. Asserted through the expanded-task count rather than by
    // checking the second task opened, because the count catches both halves —
    // a second accordion that never opens and a first one that never closes.
    await expandTask(steps, ChecklistTasks.INVITE_TEAM);
    await steps.verifyListedElement('tasks', CHECKLIST, {
      text: ChecklistTasks.INVITE_TEAM,
      child: { pageName: CHECKLIST, elementName: 'taskDescription' },
      expectedText: 'Send invites to your employees and get them started!',
    });
    await steps
      .expect('expandedTasks', CHECKLIST)
      .count.toBe(1)
      .throws('the checklist should keep exactly one task expanded at a time');
  });

  test('CHK-03 · completing a task ticks it off and moves the progress readout', async ({
    steps,
  }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);
    expect(await readProgress(steps)).toBe(ChecklistTasks.PROGRESS_FRESH);

    await completeMobileAppTask(steps);

    await expectTaskComplete(steps, ChecklistTasks.MOBILE_APP);
    await expectProgress(steps, ChecklistTasks.PROGRESS_TWO_DONE);

    // Progress is account state, not view state — a reload has to find it
    // still done, otherwise the tick was only ever local.
    await steps.navigateTo(Routes.DASHBOARD, { waitUntil: 'domcontentloaded' });
    await steps.waitForState('widget', CHECKLIST, 'visible', { timeout: 45000 });
    await expectTaskComplete(steps, ChecklistTasks.MOBILE_APP);
    await expectProgress(steps, ChecklistTasks.PROGRESS_TWO_DONE);
  });

  test('CHK-04 · dismissing the checklist removes it for good', async ({ steps }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    await dismissChecklist(steps);

    // No confirmation step, and it does not come back — dismissal is stored
    // against the account, so a fresh page load is the real assertion here.
    await steps.navigateTo(Routes.DASHBOARD, { waitUntil: 'domcontentloaded' });
    await steps.verifyPresence('mySchedulePanel', 'DashboardPage');
    await steps.verifyAbsence('widget', CHECKLIST);
  });
});
