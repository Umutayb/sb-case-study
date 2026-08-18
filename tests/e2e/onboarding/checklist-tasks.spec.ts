import type { WebElement } from '@civitas-cerebrum/element-interactions';
import { expect, test } from '../fixtures/base';
import { buildUser, ChecklistTasks, Routes, TestUser, UrlPattern } from '../data/test-data';
import { signUpToDashboard } from '../flows/signup-flow';
import { logInToDashboard } from '../flows/login-flow';
import {
  clearFirstRunOverlays,
  expandTask,
  expectProgress,
  expectTaskComplete,
  isTaskComplete,
  openDashboardChecklist,
  prepareScheduleForDrag,
  readProgress,
  startTask,
} from '../flows/checklist-flow';

const CHECKLIST = 'ChecklistPage';
const DIALOG = 'ChecklistDialogPage';
const SCHEDULE = 'SchedulePage';

/**
 * The checklist's tasks, driven by actually doing them.
 *
 * `checklist.spec.ts` covers the checklist as a surface. This file presses
 * each task's `Start` and follows where it goes — including the one task whose
 * action is a drag and drop, which is the only place in either journey where
 * the product asks for something more than a click.
 *
 * Where each task lands differs, and the tests say so rather than pretending
 * otherwise. Three tick the task off: the drag, the absence tour, and
 * `Download mobile app` over in `CHK-03`. Two hand off into another product
 * area without counting — the scheduling quick setup and the time-tracking
 * wizard — and are asserted at that handoff, because walking a five-step
 * time-tracking configuration to its end is testing time tracking, not the
 * checklist. One is broken; see `TSK-06`.
 */
test.describe('Guided checklist tasks', () => {
  test.describe.configure({ mode: 'serial' });

  let user: TestUser;

  test('TSK-01 · dragging a shift template onto the schedule completes "Add your first shift"', async ({
    steps,
    repo,
  }) => {
    test.setTimeout(300_000);
    user = buildUser();

    await signUpToDashboard(steps, user);
    await clearFirstRunOverlays(steps);
    await steps.waitForState('widget', CHECKLIST, 'visible', { timeout: 45000 });
    expect(await readProgress(steps)).toBe(ChecklistTasks.PROGRESS_FRESH);

    await startTask(steps, ChecklistTasks.FIRST_SHIFT);
    await steps.waitForUrl(UrlPattern.SCHEDULE_ADD_SHIFT, undefined, { timeout: 45000 });
    await prepareScheduleForDrag(steps);

    // The task the tour asks for: drag the "Day shift" template out of the
    // left panel and drop it on an employee's day. The template is a native
    // HTML5 draggable and the day cell delegates its hit area to an inner
    // `.day-drop-list`, so the drop has to land on that rather than on the
    // dated `n-droppable` wrapper — dropping on the wrapper is intercepted.
    await steps.verifyCount('scheduledShift', SCHEDULE, { exactly: 0 });

    // `repo.get` is typed to the platform-agnostic `Element` interface; the web
    // driver always hands back the `WebElement` that `dragAndDrop` wants.
    const dayCell = (await repo.get('dayDropZone', SCHEDULE)) as WebElement;
    await steps.on('shiftTemplateCard', SCHEDULE).first().dragAndDrop({ target: dayCell });

    await steps.expect('scheduledShift', SCHEDULE).count.toBe(1);

    // The drop writes the shift and marks the onboarding step in the
    // background. Navigating away while those are in flight cancels them and
    // the checklist never ticks, so let the page go quiet first.
    await steps.waitForNetworkIdle({ timeout: 20000, optional: true });

    // The point of the whole exercise: the checklist noticed.
    await openDashboardChecklist(steps);
    await expectTaskComplete(steps, ChecklistTasks.FIRST_SHIFT);
    await expectProgress(steps, ChecklistTasks.PROGRESS_TWO_DONE);

    // A shift that only exists in the rendered grid is not a shift. Come back
    // on a fresh page load and make the server say it too.
    await steps.navigateTo(Routes.SCHEDULE_WEEK, { waitUntil: 'domcontentloaded' });
    await steps.expect('scheduledShift', SCHEDULE).count.timeout(45000).toBe(1);
  });

  test('TSK-02 · "Optimise your schedule" enables the scheduling defaults', async ({ steps }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    await startTask(steps, ChecklistTasks.OPTIMISE_SCHEDULE);
    await steps.click('startQuickSetupButton', DIALOG);

    // The quick setup is not a preview — it turns availability management,
    // open shifts and shift exchange on, and says so. That confirmation is the
    // observable effect; the features themselves belong to the schedule area.
    await steps.waitForState('schedulingDefaultsConfirmation', DIALOG, 'visible', {
      timeout: 30000,
    });
    await steps.verifyPresence('showTourButton', DIALOG);
  });

  test('TSK-03 · "Track employee hours" opens the time-tracking setup and unblocks on a choice', async ({
    steps,
  }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    await startTask(steps, ChecklistTasks.TRACK_HOURS);
    await steps.click('startQuickSetupButton', DIALOG);

    await steps.waitForState('timeTrackingDialog', DIALOG, 'visible', { timeout: 30000 });
    await steps.verifyPresence('timeTrackingQuestion', DIALOG);

    // The wizard refuses to advance until a tracking method is chosen, so the
    // disabled-then-enabled flip is what proves the choice registered — the
    // dialog looks identical either way.
    await steps.verifyState('nextButton', DIALOG, 'disabled');
    await steps.click('clockInOption', DIALOG);
    await steps.verifyState('nextButton', DIALOG, 'enabled');
  });

  test('TSK-04 · taking the absence tour completes "Manage employee absences"', async ({
    steps,
  }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    await startTask(steps, ChecklistTasks.MANAGE_ABSENCES);
    await steps.click('showTourButton', DIALOG);

    // The tour takes over the page behind a banner rather than opening
    // anything of its own, so the banner is the only thing that distinguishes
    // "tour running" from "modal closed".
    await steps.waitForState('productTourBanner', 'ChecklistDialogPage', 'visible', {
      timeout: 30000,
    });
    await steps.verifyPresence('skipTourButton', DIALOG);
    await steps.click('skipTourButton', DIALOG);
    await steps.verifyAbsence('productTourBanner', DIALOG);

    // Starting the tour is enough — the task ticks even when the tour is
    // skipped rather than watched, which is worth pinning precisely because it
    // is the opposite of what tasks 3 and 4 do with their quick setups.
    await openDashboardChecklist(steps);
    await expectTaskComplete(steps, ChecklistTasks.MANAGE_ABSENCES);
    await expectProgress(steps, ChecklistTasks.PROGRESS_THREE_DONE);
  });

  test('TSK-05 · every task that stays incomplete keeps its call to action', async ({ steps }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    // The three tasks nothing in this file finished. Opening a task, reading
    // its pitch, or walking partway into the product area behind it does not
    // count as doing it — tasks 3 and 4 hand off to setup flows that were left
    // unfinished, and task 6 never opened at all. All three should still be
    // offering a way in.
    for (const task of [
      ChecklistTasks.OPTIMISE_SCHEDULE,
      ChecklistTasks.TRACK_HOURS,
      ChecklistTasks.INVITE_TEAM,
    ]) {
      expect(await isTaskComplete(steps, task)).toBe(false);
      // Expanded first because the accordion keeps its body out of the
      // accessibility tree while collapsed — a text assertion against a closed
      // task passes against an empty string and proves nothing.
      await expandTask(steps, task);
      await steps.verifyListedElement('tasks', CHECKLIST, {
        text: task,
        child: { pageName: CHECKLIST, elementName: 'taskStartButton' },
        expectedText: 'Start',
      });
    }

    await steps.navigateTo(Routes.DASHBOARD, { waitUntil: 'domcontentloaded' });
    await expectProgress(steps, ChecklistTasks.PROGRESS_THREE_DONE);
  });

  /**
   * Fails on purpose — see `adversarial-findings.md`.
   *
   * `Start` on "Invite your team" mounts `invite-employees-dialog` and it
   * renders nothing: zero children, a dialog box two pixels tall. Reproduced
   * three times on a freshly minted account. The test describes what the task
   * is supposed to do, and is tagged so `npm run test:no-defects` can exclude
   * it while the defect stands. It runs last because this file is serial and a
   * failure stops whatever follows it.
   */
  test('TSK-06 · "Invite your team" opens an invite dialog @known-defect', async ({ steps }) => {
    test.setTimeout(180_000);

    await logInToDashboard(steps, user.email, user.password);
    await openDashboardChecklist(steps);

    await startTask(steps, ChecklistTasks.INVITE_TEAM);

    await steps
      .expect('inviteEmployeesDialog', DIALOG)
      .visible.toBeTrue()
      .throws(
        '"Invite your team" mounted invite-employees-dialog but it rendered ' +
          'nothing — no children, and a dialog box two pixels tall',
      );
  });
});
