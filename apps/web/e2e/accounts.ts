/** The accounts global-setup creates for one run; tests read them from the environment. */
export const E2E_ACCOUNTS_ENV = 'BMI_E2E_ACCOUNTS';

export interface E2eAccount {
  key: 'planner' | 'firstSignIn' | 'locked';
  name: string;
  email: string;
  password: string;
  role: string;
  mustChangePassword: boolean;
}

export function e2eAccount(key: E2eAccount['key']): E2eAccount {
  const accounts = JSON.parse(process.env[E2E_ACCOUNTS_ENV] ?? '[]') as E2eAccount[];
  const account = accounts.find((item) => item.key === key);
  if (!account) throw new Error(`E2E account ${key} is missing: run through playwright.config.ts`);
  return account;
}
