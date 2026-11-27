import { expect, test, type Page } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-APR-05 (TASK-124): an Approver cancels an SPK with a reason (REQ-SPK-008, T15, DEC-140). The
// waiting SPK "Approver cancel me" comes from the e2e database seed.
test.describe.configure({ mode: 'serial' });

const TITLE = 'Approver cancel me';
const REASON = 'Vehicle sold before the repair';

/** Opens SPKDetail of the seeded SPK from one tab of SPKList. */
async function openFromList(page: Page, tab: RegExp): Promise<void> {
  await page.goto('/spk');
  await page.getByRole('tab', { name: tab }).click();
  // SPKList shows no title column; the search finds the seeded SPK by its title (REQ-SPK-010).
  await page.getByLabel('Search SPK, plate, title').fill(TITLE);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole('link', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/spk\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
}

test.describe('FLW-APR-05 Cancel an SPK', () => {
  test('FLW-APR-05 DEC-93 a Planner sees no Cancel SPK on a waiting SPK', async ({ page }) => {
    await signIn(page, 'planner');
    await openFromList(page, /^Pending approval/);
    await expect(page.getByRole('button', { name: 'Cancel SPK' })).toHaveCount(0);
  });

  test('FLW-APR-05 REQ-SPK-008 T15 a Supervisor cancels it with a reason; it shows Cancelled in SPKDetail and SPKList', async ({
    page,
  }) => {
    await signIn(page, 'supervisor');
    await openFromList(page, /^Pending approval/);
    await page.getByRole('button', { name: 'Cancel SPK' }).click();

    const dialog = page.getByRole('dialog', { name: /^Cancel SPK-\d{10,}\?$/ });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        'Posted issues are reversed first; Issued tyres return to stock. The creator and the executors are notified.',
      ),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep the SPK' })).toBeVisible();
    await dialog.getByLabel('Reason').fill(REASON);
    await dialog.getByRole('button', { name: 'Cancel SPK' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel SPK' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText(`Cancelled the SPK: ${REASON}`)).toBeVisible();

    await page.goto('/spk?tab=cancelled');
    await page.getByLabel('Search SPK, plate, title').fill(TITLE);
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Cancelled');
  });
});
