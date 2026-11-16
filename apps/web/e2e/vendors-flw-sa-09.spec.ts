import { expect, test, type Page } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-SA-09 (TASK-112, DEC-134): the System Admin keeps the vendor master on Settings › Vendors.
test.describe.configure({ mode: 'serial' });

const panel = (page: Page) => page.getByRole('region', { name: 'Vendor' });

test.describe('FLW-SA-09 Maintain vendors', () => {
  test('REQ-INV-014 DEC-134 add a vendor, edit it, deactivate it and activate it again', async ({
    page,
  }) => {
    const code = `E2E_${Date.now().toString(36).toUpperCase()}`;
    await signIn(page, 'systemAdmin');
    await page.goto('/settings');
    await page.getByRole('link', { name: 'Vendors' }).click();
    await expect(page).toHaveURL(/\/settings\/vendors$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Vendors' })).toBeVisible();

    await page.getByRole('button', { name: 'New vendor' }).click();
    await panel(page).getByLabel('Code').fill(code);
    await panel(page).getByLabel('Vendor').fill('Bengkel E2E Sejahtera');
    await panel(page).getByLabel('Kind').selectOption('Workshop');
    await panel(page).getByLabel('Phone').fill('021-555-0177');
    await panel(page).getByLabel('Address').fill('Jl. Raya Bekasi 5');
    await panel(page).getByRole('button', { name: 'Save' }).click();
    await expect(panel(page).getByRole('status')).toHaveText('Saved.');
    const row = page.getByRole('row', { name: /Bengkel E2E Sejahtera/ });
    await expect(row).toContainText('Workshop');
    await expect(row).toContainText('021-555-0177');
    await expect(panel(page).getByLabel('Code')).toHaveAttribute('readonly', '');

    await panel(page).getByLabel('Phone').fill('021-555-0188');
    await panel(page).getByRole('button', { name: 'Save' }).click();
    await expect(row).toContainText('021-555-0188');

    await panel(page).getByRole('button', { name: 'Deactivate' }).click();
    await page
      .getByRole('dialog', { name: 'Deactivate Bengkel E2E Sejahtera?' })
      .getByRole('button', { name: 'Deactivate' })
      .click();
    await expect(row).toContainText('Inactive');

    await row.click();
    await panel(page).getByRole('button', { name: 'Activate' }).click();
    await expect(row).not.toContainText('Inactive');
  });
});
