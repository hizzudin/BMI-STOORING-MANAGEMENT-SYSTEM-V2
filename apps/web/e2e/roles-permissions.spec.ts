import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-AM-02 of TASK-108: change a role, then the permissions of a role, in a real browser.
test.describe.configure({ mode: 'serial' });

const panel = (page: Page) => page.locator('form.panel');
const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });
const mainMenu = (page: Page) => page.getByRole('navigation', { name: 'Main menu' });

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('Roles and permissions', () => {
  test('FLW-AM-02 REQ-IAM-002 REQ-IAM-005 AC-IAM-009 a role change and a matrix change reach the user', async ({
    page,
    browser,
  }) => {
    const manager = e2eAccount('accessManager');
    await signIn(page, manager.email, manager.password);
    await expect(page).toHaveURL('/users');

    // Step 1: select the account, change its one role, save.
    await page.getByRole('button', { name: 'New account' }).click();
    await panel(page).getByLabel('Name').fill('Agus Gudang');
    await panel(page).getByLabel('Email').fill('agus.gudang@e2e.test');
    await panel(page).getByLabel('Role').selectOption('Mechanic');
    await panel(page).getByRole('button', { name: 'Save' }).click();
    await panel(page).getByRole('button', { name: 'Done' }).click();
    await row(page, 'Agus Gudang').click();
    await panel(page).getByLabel('Role').selectOption('Warehouse_Manager');
    await panel(page).getByRole('button', { name: 'Save' }).click();
    await expect(row(page, 'Agus Gudang')).toContainText('Warehouse Manager');
    await panel(page).getByLabel('Name').press('Escape');
    await expect(panel(page)).toHaveCount(0);

    // Step 2: the Roles and permissions tab; locked cells cannot change, others can.
    await page.getByRole('link', { name: 'Roles and permissions' }).click();
    await expect(page).toHaveURL('/users/roles');
    const locked = page.getByLabel('Mechanic: spk.approve');
    await expect(locked).toHaveText('L');
    await expect(page.getByRole('button', { name: 'Mechanic: spk.approve' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Accounting: vehicle.view' }).click();
    await expect(page.getByText('1 change')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Accounting: vehicle.view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // NAV-9: the Accounting user's next page load has no Vehicles or Documents item.
    const accounting = e2eAccount('accounting');
    const other = await browser.newPage();
    await signIn(other, accounting.email, accounting.password);
    await expect(mainMenu(other).getByRole('link', { name: 'Invoices' })).toBeVisible();
    await expect(mainMenu(other).getByRole('link', { name: 'Vehicles' })).toHaveCount(0);
    await expect(mainMenu(other).getByRole('link', { name: 'Documents' })).toHaveCount(0);
    await other.close();
  });
});
