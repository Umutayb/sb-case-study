import { test, expect } from '../fixtures/base';

/**
 * DEFECT — an unrecognised modal auxiliary route blanks the application.
 *
 * This test FAILS on purpose. See the README's defect section.
 *
 * Reproduced on the demo environment on 2026-08-12, three times, both
 * authenticated and not:
 *
 *   Navigate to /dashboard/my-overview(modal:<anything-unrecognised>)
 *   → Angular Router raises NG04002 ("cannot match any routes")
 *   → the URL collapses to "/" and the page renders completely empty
 *     (document.body.innerText is zero characters)
 *
 * Why it matters beyond a malformed hand-typed URL: the signup flow itself
 * lands on `(modal:onboarding-welcome)` and `(modal:highlights)`, so these
 * auxiliary routes end up in real browser history and real bookmarks. Rename
 * or retire one of those modals and every stored link to it becomes a blank
 * white screen with no message, no navigation, and no way back.
 *
 * Expected instead: an unknown route should land somewhere legible — the
 * dashboard, a not-found page, or the login redirect that every other
 * unauthenticated route performs.
 */
test.describe('Router — unrecognised modal route @known-defect', () => {
  test('RTR-01 · an unknown modal auxiliary route does not blank the page', async ({ steps }) => {
    await steps.navigateTo('/dashboard/my-overview(modal:does-not-exist)', {
      waitUntil: 'domcontentloaded',
    });

    const body = (await steps.getPageText()) ?? '';

    expect(
      body.trim().length,
      'the page rendered no content at all — Angular Router failed to match ' +
        'the auxiliary route and left a blank document',
    ).toBeGreaterThan(0);
  });
});
