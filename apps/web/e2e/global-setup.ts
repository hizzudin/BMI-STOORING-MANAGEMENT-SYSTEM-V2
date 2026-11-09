import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { E2E_ACCOUNTS_ENV, type E2eAccount } from './accounts';

/**
 * Fresh accounts for every run, with passwords made here and never stored: the API's e2e:db command
 * rebuilds the bmi_e2e database with them. The web never touches the database itself (DEC-66).
 */
export default function globalSetup(): void {
  const password = () => `e2e${randomBytes(9).toString('base64url')}7`;
  const accounts: E2eAccount[] = [
    {
      key: 'planner',
      name: 'Planner E2E',
      email: 'planner@e2e.test',
      password: password(),
      role: 'Planner',
      mustChangePassword: false,
    },
    {
      key: 'firstSignIn',
      name: 'New Mechanic',
      email: 'new.mechanic@e2e.test',
      password: password(),
      role: 'Mechanic',
      mustChangePassword: true,
    },
    {
      key: 'locked',
      name: 'Field Coordinator E2E',
      email: 'korlap@e2e.test',
      password: password(),
      role: 'Field_Coordinator',
      mustChangePassword: false,
    },
  ];
  const serialized = JSON.stringify(accounts);
  execFileSync('pnpm', ['--filter', '@bmi/api', 'e2e:db'], {
    env: { ...process.env, E2E_ACCOUNTS: serialized },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.env[E2E_ACCOUNTS_ENV] = serialized;
}
