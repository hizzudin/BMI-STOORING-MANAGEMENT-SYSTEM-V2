import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-SA-05 of TASK-116: the System Admin adds a class as data and saves a new layout version.
test.describe.configure({ mode: 'serial' });

const editor = (page: Page) => page.getByRole('region', { name: 'Layout' });
const preview = (page: Page) => page.getByRole('img', { name: /^Layout preview/ });

test.describe('Vehicle classes and chassis layouts', () => {
  test('FLW-SA-05 AC-PLC-010 REQ-PLC-013 DEC-120 a Powered 8x4 is added as data, then saved as layout v2', async ({
    page,
  }, testInfo) => {
    // Unique per attempt: a retry finds the class of the failed attempt already saved.
    const run = `${Date.now().toString(36)}${testInfo.retry}`;
    const name = `Powered 8x4 ${run}`;
    const admin = e2eAccount('systemAdmin');
    await page.goto('/login');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto('/settings/chassis-layouts');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Vehicle classes and chassis layouts',
    );
    await page.getByRole('button', { name: 'New class' }).click();
    await editor(page).getByLabel('Code').fill(`P8x4_${run}`);
    await editor(page).getByLabel('Name').fill(name);
    await editor(page).getByLabel('Unit kind').selectOption('Powered');
    // Steer, Steer (close), Drive dual (wide), Drive dual (close), no spare.
    for (let i = 0; i < 3; i += 1)
      await editor(page).getByRole('button', { name: 'Add axle' }).click();
    await editor(page).getByLabel('Axle 3 role').selectOption('Drive');
    await editor(page).getByLabel('Axle 3 tyres per side').selectOption('2');
    await editor(page).getByLabel('Axle 3 spacing').selectOption('Wide');
    await editor(page).getByLabel('Axle 4 role').selectOption('Drive');
    await editor(page).getByLabel('Axle 4 tyres per side').selectOption('2');
    await expect(preview(page).locator('g.m-tyre')).toHaveCount(12);
    await expect(page.getByRole('list', { name: 'Tyre colours' })).toBeVisible();

    await page.getByRole('button', { name: 'Save class' }).click();
    await expect(page.getByRole('status')).toHaveText(`Class ${name} saved.`);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('12 + 0 spares');
    await expect(row).toContainText('v1');

    await editor(page).getByLabel('Spare positions').fill('1');
    await expect(preview(page).locator('g.m-tyre')).toHaveCount(13);
    await page.getByRole('button', { name: 'Save as new layout version' }).click();
    await expect(page.getByRole('status')).toHaveText(`Layout v2 of ${name} saved.`);
    await expect(row).toContainText('12 + 1 spare');
    await expect(row).toContainText('v2');
  });
});
