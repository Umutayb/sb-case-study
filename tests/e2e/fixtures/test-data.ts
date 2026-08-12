/**
 * Centralised test data and routing constants.
 *
 * Secrets come from `.env` (gitignored); nothing here holds a credential
 * literal. See `.env.example` for the shape.
 */

export class Routes {
  static readonly SIGNUP = '/signup';
  static readonly LOGIN = '/login';
  static readonly FORGOT_PASSWORD = '/login/forgot';
}

/**
 * URL expectations are asserted per scenario rather than through one shared
 * prefix match, because the two flows genuinely land on different URLs:
 * signup completes onto the `(modal:highlights)` auxiliary route, login does
 * not. A single loose matcher would hide a regression in either one.
 */
export class UrlPattern {
  static readonly LOGIN = /\/login$/;
  static readonly SIGNUP = /\/signup$/;
  static readonly ONBOARDING = /\/onboarding$/;
  static readonly MFA_PROMOTE = /\/login\/mfa-promote$/;

  /**
   * Where the signup + onboarding flow finishes.
   *
   * A first-run modal is opened as an Angular auxiliary route, and which one
   * varies (`onboarding-welcome`, `highlights`), sometimes with a `campaign`
   * query appended. The modal's presence is the assertion; its identity is
   * not, because pinning to one name made the spec fail on a product
   * behaviour that was never under test.
   */
  static readonly DASHBOARD_AFTER_SIGNUP =
    /\/dashboard\/my-overview\(modal:[a-z-]+\)(?:\?.*)?$/;

  /** Where the login flow finishes — no first-run modal on a returning user. */
  static readonly DASHBOARD_AFTER_LOGIN = /\/dashboard\/my-overview(?:\?.*)?$/;
}

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  password: string;
  businessName: string;
  employeeCount: string;
}

/**
 * The demo environment is shared and never reset, so every signup needs an
 * address that has not been used before. Plus-addressing keeps them unique
 * while still routing to one real mailbox.
 */
export function uniqueEmail(): string {
  const root = process.env.SB_SIGNUP_EMAIL_ROOT ?? 'qa.candidate@example.com';
  const [local, domain] = root.split('@');
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return `${local}+sb-${stamp}@${domain}`;
}

/**
 * Generated rather than hardcoded: a literal here would be a credential in
 * version control, and every minted account should get its own secret.
 * Shape satisfies the usual upper/lower/digit/symbol policy.
 */
export function generatePassword(): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `Sb!${entropy}A9`;
}

export function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    // Synthetic rather than a real identity: CI mints an account on every
    // run, and each one persists in a third-party demo database.
    firstName: 'QA',
    lastName: 'Tester',
    email: uniqueEmail(),
    mobileNumber: '612345678',
    password: generatePassword(),
    businessName: `QA Case Study ${Date.now().toString(36)}`,
    employeeCount: '25',
    ...overrides,
  };
}

/** Credentials for the pre-existing trial account, when one is supplied. */
export class ExistingAccount {
  static get email(): string | undefined {
    return process.env.SB_EMAIL || undefined;
  }

  static get password(): string | undefined {
    return process.env.SB_PASSWORD || undefined;
  }

  static get isConfigured(): boolean {
    return Boolean(this.email && this.password);
  }
}
