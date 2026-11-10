import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-AM-01, FLW-AM-03, FLW-AM-04 of TASK-107: the Access Manager's own area, in a real browser.
test.describe.configure({ mode: 'serial' });

const refusal = (page: Page) => page.locator('p.refusal');
const panel = (page: Page) => page.locator('form.panel');
const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signInAsAccessManager(page: Page) {
  const manager = e2eAccount('accessManager');
  await signIn(page, manager.email, manager.password);
  await expect(page).toHaveURL('/users');
}

test.describe('Access Manager', () => {
  test('FLW-AM-01 REQ-IAM-002 REQ-IAM-009 creates an account whose temporary password signs in once', async ({
    page,
    browser,
  }) => {
    await signInAsAccessManager(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Users and roles');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await expect(menu.getByRole('link')).toHaveText(['Users and roles', 'Audit log']);
    await page.getByRole('button', { name: 'New account' }).click();
    await panel(page).getByLabel('Name').fill('Dewi Mekanik');
    await panel(page).getByLabel('Email').fill('dewi.mekanik@e2e.test');
    await panel(page).getByLabel('Role').selectOption('Mechanic');
    await panel(page).getByRole('button', { name: 'Save' }).click();
    const temporary = (await panel(page).locator('.temp-password').textContent()) ?? '';
    expect(temporary).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{12}$/);
    await panel(page).getByRole('button', { name: 'Done' }).click();
    await expect(row(page, 'Dewi Mekanik')).toContainText('Mechanic');

    const other = await browser.newPage();
    await signIn(other, 'dewi.mekanik@e2e.test', temporary);
    await expect(other).toHaveURL('/change-password');
    await other.close();
  });

  test('FLW-AM-04 REQ-IAM-001 unlocks a locked account, then deactivates and activates it', async ({
    page,
    browser,
  }) => {
    const driver = e2eAccount('driver');
    const field = await browser.newPage();
    await field.goto('/login');
    await field.getByLabel('Email').fill(driver.email);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await field.getByLabel('Password').fill(`wrong${attempt}pass`);
      await field.getByRole('button', { name: 'Sign in' }).click();
      await expect(refusal(field)).toBeVisible();
    }
    await expect(refusal(field)).toContainText('locked');

    await signInAsAccessManager(page);
    await expect(row(page, driver.name)).toContainText('Locked');
    await row(page, driver.name).click();
    await panel(page).getByRole('button', { name: 'Unlock' }).click();
    await expect(row(page, driver.name)).toContainText('Active');

    await panel(page).getByRole('button', { name: 'Deactivate' }).click();
    const confirm = page.getByRole('dialog', { name: `Deactivate ${driver.name}?` });
    await confirm.getByRole('button', { name: 'Deactivate' }).click();
    await expect(row(page, driver.name)).toContainText('Inactive');

    await field.getByLabel('Password').fill(driver.password);
    await field.getByRole('button', { name: 'Sign in' }).click();
    await expect(refusal(field)).toHaveText('The email or password is not correct.');

    await panel(page).getByRole('button', { name: 'Activate' }).click();
    await expect(row(page, driver.name)).toContainText('Active');
    await field.getByRole('button', { name: 'Sign in' }).click();
    await expect(field).not.toHaveURL('/login');
    await field.close();
  });

  test('FLW-AM-03 REQ-IAM-004 moves the System Admin role with a reason', async ({ page }) => {
    const admin = e2eAccount('systemAdmin');
    const driver = e2eAccount('driver');
    await signInAsAccessManager(page);
    await expect(row(page, admin.name)).toContainText('System Admin');
    await page.getByRole('button', { name: 'Move System Admin role' }).click();
    await panel(page)
      .getByLabel('New System Admin')
      .selectOption({ label: `${driver.name} (Driver)` });
    await panel(page).getByLabel('Reason').fill('Yusuf moves to the Jakarta office');
    await panel(page).getByRole('button', { name: 'Move role' }).click();
    const confirm = page.getByRole('dialog', {
      name: `Move the System Admin role to ${driver.name}?`,
    });
    await confirm.getByRole('button', { name: 'Move role' }).click();
    await expect(row(page, driver.name)).toContainText('System Admin');
    await expect(row(page, admin.name)).toContainText('No role');

    // The role goes back to Yusuf, an account without a role, so later specs find their System Admin.
    await page.getByRole('button', { name: 'Move System Admin role' }).click();
    await panel(page)
      .getByLabel('New System Admin')
      .selectOption({ label: `${admin.name} (No role)` });
    await panel(page).getByLabel('Reason').fill('Yusuf is back');
    await panel(page).getByRole('button', { name: 'Move role' }).click();
    await page
      .getByRole('dialog', { name: `Move the System Admin role to ${admin.name}?` })
      .getByRole('button', { name: 'Move role' })
      .click();
    await expect(row(page, admin.name)).toContainText('System Admin');
    await expect(row(page, driver.name)).toContainText('No role');
  });

  test('AC-IAM-003 RL-4 the System Admin cannot open Users and roles', async ({ page }) => {
    const driver = e2eAccount('driver');
    await signIn(page, driver.email, driver.password);
    await expect(page).not.toHaveURL('/login');
    await page.goto('/users');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not allowed');
    expect((await page.request.get('/api/accounts')).status()).toBe(403);
  });
});
