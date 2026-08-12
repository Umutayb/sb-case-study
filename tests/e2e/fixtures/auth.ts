import fs from 'node:fs';
import path from 'node:path';

export interface Account {
  email: string;
  password: string;
  /** How this account came to exist — surfaced in the run output. */
  source: 'env' | 'minted';
}

const ACCOUNT_FILE = path.join(process.cwd(), 'tests/e2e/.auth/account.json');

export function saveAccount(account: Account): void {
  fs.mkdirSync(path.dirname(ACCOUNT_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(account, null, 2));
}

export function readAccount(): Account {
  if (!fs.existsSync(ACCOUNT_FILE)) {
    throw new Error(
      `No account available at ${ACCOUNT_FILE}. The 'setup' project should have ` +
        `created one — run the whole suite rather than this spec in isolation.`,
    );
  }
  return JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8')) as Account;
}

export const accountFilePath = ACCOUNT_FILE;
