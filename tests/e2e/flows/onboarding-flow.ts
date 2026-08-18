import type { Steps } from '@civitas-cerebrum/element-interactions';
import { Routes, UrlPattern } from '../data/test-data';

const ONBOARDING = 'OnboardingPage';

/**
 * Helpers for `/onboarding` treated as a journey in its own right.
 *
 * `signup-flow.ts` already owns `completeOnboardingWizard`, which walks the
 * wizard blind — Next-or-Skip until the completion screen — because its job
 * is to *get past* onboarding on the way to the dashboard. These helpers do
 * the opposite: they assert each step is the step it claims to be, so a
 * screen that silently disappears or changes order fails a test instead of
 * being clicked through.
 */

/** The three data steps, in render order, with the field each pre-fills. */
export const WIZARD_STEPS = [
  { heading: 'teamsHeading', prefilledField: 'teamNameInput' },
  { heading: 'employeesHeading', prefilledField: 'employeeFirstName' },
  { heading: 'shiftTemplatesHeading', prefilledField: 'shiftTemplateName' },
] as const;

/**
 * Enters the wizard by direct navigation.
 *
 * Legitimate because `/onboarding` has no completion gate and no memory: an
 * account that already finished it lands back on the teams step with the same
 * pre-filled defaults. `SGN-01` covers the real signup → onboarding handoff,
 * so these specs do not need to re-mint an account per scenario.
 */
export async function enterWizard(steps: Steps): Promise<void> {
  await steps.navigateTo(Routes.ONBOARDING, { waitUntil: 'domcontentloaded' });
  await steps.waitForUrl(UrlPattern.ONBOARDING, undefined, { timeout: 30000 });
  await steps.waitForState('teamsHeading', ONBOARDING, 'visible', { timeout: 30000 });
}

/** Advances past the current step with the named control. */
export async function advance(steps: Steps, control: 'nextButton' | 'skipButton'): Promise<void> {
  await steps.click(control, ONBOARDING);
}

/**
 * Waits for the completion screen.
 *
 * Split out because both the Next path and the Skip path end here, and both
 * need the same evidence that they actually arrived rather than stalling on
 * the last data step.
 */
export async function waitForCompletionScreen(steps: Steps): Promise<void> {
  await steps.waitForState('allSetHeading', ONBOARDING, 'visible', { timeout: 45000 });
  await steps.verifyPresence('seeInActionButton', ONBOARDING);
}

/**
 * Adds a team row and names it.
 *
 * The new row is the second `input[name='name']`, so it is addressed by index
 * rather than by a fresh selector — the rows are identical by construction and
 * only position distinguishes them.
 */
export async function addTeam(steps: Steps, name: string): Promise<void> {
  await steps.click('addTeamButton', ONBOARDING);
  await steps.expect('teamNameInput', ONBOARDING).count.toBe(2);
  await steps.on('teamNameInput', ONBOARDING).nth(1).fill(name);
}
