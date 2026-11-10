import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-AM-06 of TASK-109: the Access Manager lets Planners approve for a while, in a real browser.
test.describe.configure({ mode: 'serial' });

const panel = (page: Page) => page.getByRole('dialog', { name: 'Planner approval' });
const mainMenu = (page: Page) => page.getByRole('navigation', { name: 'Main menu' });

async function signIn(page: Page, key: 'accessManager' | 'planner') {
  const account = e2eAccount(key);
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe('Planner approval switch', () => {
  test('FLW-AM-06 REQ-IAM-008 RL-7 switched on, Planners see Approvals; switched off, it is gone', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'accessManager');
    await page.goto('/users/roles');
    await expect(page.getByText('Planner approval is off')).toBeVisible();

    await page.getByRole('button', { name: 'Switch on' }).click();
    await panel(page).getByLabel('SPK creation').check();
    await panel(page).getByLabel('SPK completion').check();
    await panel(page).getByLabel('Reason').fill('Supervisor and GM on site visit');
    await panel(page).getByRole('button', { name: 'Switch on' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByText('Planner approval is on')).toBeVisible();
    await expect(page.getByText('SPK creation, SPK completion · until switched off')).toBeVisible();

    const planner = await browser.newPage();
    await signIn(planner, 'planner');
    await expect(mainMenu(planner).getByRole('link', { name: 'Approvals' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch off' }).click();
    await panel(page).getByLabel('Reason').fill('Back on site');
    await panel(page).getByRole('button', { name: 'Switch off' }).click();
    await expect(page.getByText('Planner approval is off')).toBeVisible();

    // NAV-9: the Planner's next page load has no Approvals item.
    await planner.reload();
    await expect(mainMenu(planner).getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(mainMenu(planner).getByRole('link', { name: 'Approvals' })).toHaveCount(0);
    await planner.close();
  });
});
