# Defect evidence

Screen recordings and screenshots of the defects described in the root README.
Each pair is the artefact of the failing test named beside it, captured on the
demo environment on 2026-08-12.

Regenerate with:

```bash
npm run evidence
```

That runs only the `@known-defect` tests with video, screenshots and traces on,
converts Playwright's WebM output to MP4, and writes the results here.

| Evidence | Defect | Failing test |
|---|---|---|
| `01-router-blank-page.mp4` / `.png` | An unrecognised `(modal:…)` auxiliary route raises Angular `NG04002`, collapses the URL to `/`, and renders an empty document. The recording is short because the failure is immediate — the screenshot is the whole story: a blank white page. | `router-malformed-modal.spec.ts` |
| `02-duplicate-email-no-conflict-message.mp4` / `.png` | Registering with an email that already has an account is accepted with no conflict message; the recording shows the full registration submit and the questionnaire opening as though it succeeded. | `signup-duplicate-email.spec.ts` |
| `03-duplicate-email-password-rejected.mp4` / `.png` | The same duplicate registration, followed by a login attempt with the password just chosen — rejected with "Unable to log you in with the supplied credentials". | `signup-duplicate-email.spec.ts` |

The videos record the browser viewport at 1280×720 for the whole test, so each
one shows the complete reproduction from first navigation to the failing
assertion, not just the final frame.
