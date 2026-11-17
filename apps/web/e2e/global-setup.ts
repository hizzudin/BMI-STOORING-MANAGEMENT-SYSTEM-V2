import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chromium, type FullConfig } from '@playwright/test';
import { E2E_ACCOUNTS_ENV, type E2eAccount } from './accounts';

/**
 * Playwright starts the web servers before this setup, so the stack is up but cold, and the first
 * spec used to pay every first time inside its 30 s timeout: the browser launch, the first page, the
 * first render of /login and its chunks, the first sign-in. Right after a build the antivirus scans
 * the new files and the disk is busy, which stretched those from about 5 s to over 30 s. This setup
 * has no test timeout, so one browser visit to /login and one sign-in here take that cost instead.
 * The sign-in uses an address no account has: it reads the database and hashes, and writes nothing.
 */
async function warmUp(baseURL: string): Promise<void> {
  const started = Date.now();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const login = await page.goto(`${baseURL}/login`, { timeout: 120_000 });
    if (login?.status() !== 200) throw new Error(`Warm-up: /login answered ${login?.status()}`);
  } finally {
    await browser.close();
  }
  const signIn = await fetch(`${baseURL}/api/auth/sign-in`, {
    method: 'POST',
    headers: { Origin: baseURL, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'warm-up@e2e.test', password: 'warm-up', client: 'mobile' }),
  });
  if (signIn.status !== 401) throw new Error(`Warm-up: sign-in answered ${signIn.status}`);
  console.log(`Warm-up done in ${Date.now() - started} ms`);
}

/**
 * Fresh accounts for every run, with passwords made here and never stored: the API's e2e:db command
 * rebuilds the bmi_e2e database with them. The web never touches the database itself (DEC-66).
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
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
    {
      key: 'accessManager',
      name: 'Access Manager E2E',
      email: 'access.manager@e2e.test',
      password: password(),
      role: 'Access_Manager',
      mustChangePassword: false,
    },
    {
      key: 'systemAdmin',
      name: 'Yusuf E2E',
      email: 'yusuf@e2e.test',
      password: password(),
      role: 'System_Admin',
      mustChangePassword: false,
    },
    {
      key: 'driver',
      name: 'Rina E2E',
      email: 'rina@e2e.test',
      password: password(),
      role: 'Driver',
      mustChangePassword: false,
    },
    {
      key: 'accounting',
      name: 'Accounting E2E',
      email: 'accounting@e2e.test',
      password: password(),
      role: 'Accounting',
      mustChangePassword: false,
    },
    {
      key: 'supervisor',
      name: 'Budi E2E',
      email: 'budi@e2e.test',
      password: password(),
      role: 'Supervisor',
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
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('Warm-up: the config has no baseURL');
  await warmUp(baseURL);
}
