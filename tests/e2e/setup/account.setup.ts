import { test } from '../fixtures/base';
import { ExistingAccount, buildUser } from '../data/test-data';
import { saveAccount } from '../fixtures/auth';
import { signUpToDashboard } from '../flows/signup-flow';

/**
 * Resolves the account the login specs authenticate with.
 *
 * Preferred source is `.env`, because a stable account keeps the login specs
 * fast and independent of signup health. When it is absent — a reviewer who
 * just cloned the repo — the suite mints its own account by running the real
 * signup flow, so the run is still green without any local configuration.
 */
test('SETUP-01 · resolve an account for the login specs', async ({ steps }) => {
  test.setTimeout(180_000);

  if (ExistingAccount.isConfigured) {
    saveAccount({
      email: ExistingAccount.email!,
      password: ExistingAccount.password!,
      source: 'env',
    });
    return;
  }

  const user = buildUser();
  await signUpToDashboard(steps, user);

  saveAccount({ email: user.email, password: user.password, source: 'minted' });
});
