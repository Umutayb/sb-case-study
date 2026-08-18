import { test } from '../fixtures/base';
import { buildUser, Routes, UrlPattern } from '../data/test-data';
import { submitRegistrationForm } from '../flows/signup-flow';

const QUIZ = 'SignupQuestionnairePage';
const SIGNUP = 'SignupPage';

/**
 * The signup questionnaire keeps no durable state.
 *
 * Navigating away and back — or using browser Back/Forward — discards every
 * answer and returns the user to registration step 1. The in-app `Back`
 * button does preserve answers; only leaving the SPA loses them.
 *
 * This is pinned rather than reported as a defect. It is defensible as
 * designed: a registration form that does not persist half-entered
 * credentials across navigation is a reasonable choice, and nothing here
 * misleads the user in the moment. It is recorded because an eight-step
 * questionnaire with no resume is a real conversion risk, and because if the
 * product ever adds persistence, this test should be the thing that notices.
 */
test.describe('Signup — questionnaire persistence', () => {
  test('SGN-09 · leaving the signup flow and returning discards questionnaire progress', async ({
    steps,
  }) => {
    test.setTimeout(120_000);
    const user = buildUser();

    await submitRegistrationForm(steps, user);

    // Registration succeeded — we are on questionnaire step 1.
    await steps.verifyPresence('businessName', QUIZ);
    await steps.fill('businessName', QUIZ, user.businessName);
    await steps.verifyInputValue('businessName', QUIZ, user.businessName);

    // Leave the flow entirely, then come back by URL.
    await steps.navigateTo(Routes.LOGIN, { waitUntil: 'domcontentloaded' });
    await steps.waitForUrl(UrlPattern.LOGIN, undefined, { timeout: 20000 });

    await steps.navigateTo(Routes.SIGNUP, { waitUntil: 'domcontentloaded' });

    // Back at registration step 1 — the questionnaire is gone, and so is the
    // account-creation progress that preceded it.
    await steps.verifyPresence('firstName', SIGNUP);
    await steps.verifyPresence('getStartedButton', SIGNUP);
    await steps.verifyAbsence('businessName', QUIZ);
  });
});
