import type { Steps } from '@civitas-cerebrum/element-interactions';
import { ChecklistTasks, Routes } from '../data/test-data';

const CHECKLIST = 'ChecklistPage';
const DIALOG = 'ChecklistDialogPage';
const DASHBOARD = 'DashboardPage';
const CHROME = 'AppChromePage';
const SCHEDULE = 'SchedulePage';

/**
 * Helpers for the guided "Get started" checklist that survives the
 * `/onboarding` wizard and lives on the dashboard.
 *
 * The checklist renders from one state in two places — the
 * `my-checklist-widget` card on the dashboard, and a `checklist-panel` side
 * panel opened from a sidebar entry. Everything here targets the **widget**,
 * because the sidebar entry belongs to a navigation variant that was observed
 * appearing and then disappearing for the same account mid-session. The
 * widget was present on every visit; the sidebar entry was not.
 */

/**
 * Clears the first-run furniture that covers a freshly minted dashboard.
 *
 * Three separate things can be in the way, and which ones appear varies by
 * run: the "Welcome to Shiftbase" dialog, and one or two coach-mark popovers
 * announcing the navigation ("New navigation", "Same button, simpler name").
 * The popovers matter more than they look — they render in a CDK overlay
 * positioned directly over the checklist, and they swallow clicks aimed at
 * tasks underneath rather than being visibly in the way.
 */
export async function clearFirstRunOverlays(steps: Steps): Promise<void> {
  if (await steps.clickIfPresent('firstRunDialogClose', DASHBOARD)) {
    await steps.verifyAbsence('firstRunDialog', DASHBOARD);
  }
  await drainCoachMarks(steps);
}

/**
 * Presses through however many coach-mark popovers are currently stacked up.
 *
 * They chain — dismissing one reveals the next — and the schedule's
 * walkthrough runs several steps deep ("Customise your view" → …). All of them
 * are one `sb-popover` with one action button, whether that button says
 * "Got it!", "Got it" or "Next", so this drains by pressing whatever the
 * popover offers rather than by naming every label.
 *
 * `clickIfPresent` rather than a wait-then-click: coach marks are genuinely
 * optional — which ones appear varies per run and they can close themselves —
 * and a probe followed by a blocking click loses that race. The bound is a
 * backstop; callers that actually need the surface clear assert the popover is
 * gone afterwards.
 *
 * Note what this deliberately does NOT touch: modal dialogs. Closing a dialog
 * that happens to be open is not housekeeping — on the schedule it cancels the
 * guided tour, and the checklist then refuses to count the shift that follows.
 */
export async function drainCoachMarks(steps: Steps): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    if (!(await steps.clickIfPresent('coachMarkActionButton', CHROME))) return;
  }
}

/** Navigates to the dashboard and waits for the checklist widget to render. */
export async function openDashboardChecklist(steps: Steps): Promise<void> {
  await steps.navigateTo(Routes.DASHBOARD, { waitUntil: 'domcontentloaded' });
  await steps.waitForState('widget', CHECKLIST, 'visible', { timeout: 45000 });
  await clearFirstRunOverlays(steps);
}

/** The progress readout above the task list, e.g. `14%`. */
export async function readProgress(steps: Steps): Promise<string> {
  return (await steps.getText('widgetProgress', CHECKLIST)).trim();
}

/**
 * Titles of the tasks currently marked complete.
 *
 * Completion is carried by the status icon — `check-circle-solid` when done,
 * plain `circle` when not — so the repository entry filters on the icon and
 * this returns whatever survived the filter.
 */
export async function completedTasks(steps: Steps): Promise<string[]> {
  if ((await steps.getCount('completedTasks', CHECKLIST)) === 0) return [];
  const texts = await steps.getAll('completedTasks', CHECKLIST, {
    child: { pageName: CHECKLIST, elementName: 'taskTitle' },
  });
  return texts.map((text) => text.trim());
}

/** True when the named task shows the completed icon, read once. */
export async function isTaskComplete(steps: Steps, title: string): Promise<boolean> {
  return (await completedTasks(steps)).includes(title);
}

/**
 * Waits for the named task to be ticked off.
 *
 * Completion is recorded server-side and the widget renders before it catches
 * up, so a single read taken the moment the dashboard paints can miss a task
 * that is about to tick. These two assertions retry; `isTaskComplete` and
 * `readProgress` do not, and are for asserting that something has *not*
 * changed.
 */
export async function expectTaskComplete(steps: Steps, title: string): Promise<void> {
  await steps.verifyListedElement('completedTasks', CHECKLIST, { text: title });
}

/** Waits for the progress readout to settle on an expected value. */
export async function expectProgress(steps: Steps, expected: string): Promise<void> {
  await steps.expect('widgetProgress', CHECKLIST).text.timeout(45000).toBe(expected);
}

/**
 * Expands a task to reveal its description and call to action.
 *
 * One at a time: opening a task collapses whichever was open. Clicking the
 * already-open task does not close it — there is no toggle-off — so callers
 * that need everything collapsed have to reload rather than click again.
 */
export async function expandTask(steps: Steps, title: string): Promise<void> {
  await steps.clickListedElement('tasks', CHECKLIST, {
    text: title,
    child: { pageName: CHECKLIST, elementName: 'taskHeader' },
  });
  await steps.expect('expandedTasks', CHECKLIST).count.toBe(1);
}

/** Expands a task and presses its `Start` button. */
export async function startTask(steps: Steps, title: string): Promise<void> {
  await expandTask(steps, title);
  await steps.clickListedElement('tasks', CHECKLIST, {
    text: title,
    child: { pageName: CHECKLIST, elementName: 'taskStartButton' },
  });
  await steps.waitForState('dialog', DIALOG, 'visible', { timeout: 30000 });
}

/**
 * Gets the schedule into the state the drag needs: shift templates on screen,
 * nothing floating over the grid.
 *
 * What stands in the way varies between runs, because the schedule ships in
 * more than one shape. Sometimes "Add your first shift" opens a guided tour —
 * a "Let's do it!" splash, then a coach mark explaining the drag — and leaves
 * the template panel open. Sometimes it just lands on the week view with the
 * panel collapsed behind its "Shifts / Teams" toggle. Both were observed on
 * freshly minted accounts hours apart.
 *
 * So this asserts the *end state* it needs rather than a fixed sequence: any
 * splash and coach marks are taken if offered, the panel is opened if it is
 * shut, and the wait at the end is on the template actually being draggable.
 */
export async function prepareScheduleForDrag(steps: Steps): Promise<void> {
  // Order matters here, and not obviously. The tour splash has to be accepted
  // BEFORE the coach marks are cleared: clearing first walks the schedule's own
  // multi-step walkthrough ("Customise your view" → Next → …) with it, and the
  // shift that gets dragged afterwards is then just a shift — it lands on the
  // schedule but the checklist never ticks. Taking the splash first keeps the
  // `;onboardingStep=SCHEDULE_SHIFT` context alive through the drop, which is
  // what makes the drag count as completing the task.
  //
  // Waited for rather than probed: under load the splash can render a beat
  // after the route settles, and a bare `clickIfPresent` skips it, starts no
  // tour, and produces a shift the checklist ignores. Optional, because the
  // variant without a tour never shows one.
  await steps.waitForState('tourStartButton', SCHEDULE, 'visible', {
    timeout: 15000,
    optional: true,
  });
  await steps.clickIfPresent('tourStartButton', SCHEDULE);

  // Now the coach marks, including the one explaining the drag. Left up, they
  // render over the grid and silently swallow the drop. The first one arrives a
  // beat after the splash closes, so wait for it rather than racing it.
  await steps.waitForState('coachMarkPopover', CHROME, 'visible', {
    timeout: 10000,
    optional: true,
  });
  await drainCoachMarks(steps);
  await steps.verifyAbsence('coachMarkPopover', CHROME);

  // `aria-expanded` on the toggle stays `false` even once the panel is open,
  // so the template's own visibility is the only trustworthy signal.
  if (!(await steps.isVisible('shiftTemplateCard', SCHEDULE, { timeout: 5000 }))) {
    await steps.click('shiftsSidebarToggle', SCHEDULE);
  }
  await steps.waitForState('shiftTemplateCard', SCHEDULE, 'visible', { timeout: 30000 });
}

/** Dismisses the checklist from the dashboard widget. */
export async function dismissChecklist(steps: Steps): Promise<void> {
  await steps.click('dismissButton', CHECKLIST);
  await steps.waitForState('widget', CHECKLIST, 'detached', { timeout: 20000 });
}

/**
 * The task whose completion is cheapest to drive end to end.
 *
 * "Download mobile app" finishes on a single `Done!` press with no feature
 * configuration behind it, which makes it the honest way to assert that
 * *completing* a task moves the progress readout — as opposed to asserting
 * the readout against a task that only ever hands off to another product
 * area.
 */
export async function completeMobileAppTask(steps: Steps): Promise<void> {
  await startTask(steps, ChecklistTasks.MOBILE_APP);
  await steps.click('doneButton', DIALOG);
  await steps.waitForState('dialog', DIALOG, 'detached', { timeout: 20000 });
}
