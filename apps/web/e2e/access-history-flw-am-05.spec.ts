import { expect, test, type Page } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-AM-05 (TASK-110): the Access Manager switches Planner approval on and off, then reviews both
// changes on the Access history tab and follows the full trail to the Audit log.
test.describe.configure({ mode: 'serial' });

const panel = (page: Page) => page.getByRole('dialog', { name: 'Planner approval' });

test.describe('FLW-AM-05 Review access changes', () => {
  test('REQ-IAM-007 Access history lists the access changes in words; the full trail is the Audit log', async ({
    page,
  }) => {
    await signIn(page, 'accessManager');
    await page.goto('/users/roles');
    await page.getByRole('button', { name: 'Switch on' }).click();
    await panel(page).getByLabel('SPK creation').check();
    await panel(page).getByLabel('Reason').fill('Supervisor on leave');
    await panel(page).getByRole('button', { name: 'Switch on' }).click();
    await expect(page.getByText('Planner approval is on')).toBeVisible();
    await page.getByRole('button', { name: 'Switch off' }).click();
    await panel(page).getByLabel('Reason').fill('Supervisor is back');
    await panel(page).getByRole('button', { name: 'Switch off' }).click();
    await expect(page.getByText('Planner approval is off')).toBeVisible();

    await page.getByRole('link', { name: 'Access history' }).click();
    await expect(page).toHaveURL(/\/users\/history$/);
    await expect(page.getByText(/^Page 1 of \d+ \(\d+ total\)$/)).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows.nth(0)).toContainText('Access Manager E2E');
    await expect(rows.nth(0)).toContainText('Planner approval off');
    await expect(rows.nth(1)).toContainText(
      'Planner approval on until it is switched off (SPK creation)',
    );

    await page.getByRole('link', { name: 'Full trail in Audit log' }).click();
    await expect(page).toHaveURL(/\/audit-log\?area=Access$/);
    await expect(page.getByLabel('Area')).toHaveValue('Access');
    await expect(page.getByText(/^Page 1 of \d+ \(\d+ total\)$/)).toBeVisible();
    const first = page.locator('tbody tr').first();
    await expect(first).toContainText('Planner approval');
    await expect(first).toContainText('Access Manager E2E');
  });
});
