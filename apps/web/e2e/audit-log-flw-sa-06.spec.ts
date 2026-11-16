import { expect, test, type Page } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-SA-06 (TASK-110, DEC-133): while Live the System Admin may not approve an SPK it submitted
// itself (BR-03), so it goes back to Setup, approves it there (Self-approved), finds the decision on
// the Audit log and goes live again; the SPK comes from the e2e database seed.
test.describe.configure({ mode: 'serial' });

async function switchMode(page: Page, to: 'Back to Setup' | 'Go live') {
  await page.goto('/setup');
  await page.getByRole('button', { name: to }).click();
  const live = to === 'Go live';
  const dialog = page.getByRole('dialog', { name: live ? 'Go live?' : 'Back to Setup mode?' });
  await dialog.getByLabel('Reason').fill('FLW-SA-06 oversight check');
  await dialog
    .getByLabel(live ? 'Type GO LIVE to confirm' : 'Type BACK TO SETUP to confirm')
    .fill(live ? 'GO LIVE' : 'BACK TO SETUP');
  await dialog.getByRole('button', { name: to }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: live ? 'Back to Setup' : 'Go live' }),
  ).toBeVisible();
}

test.describe('FLW-SA-06 Oversight', () => {
  test('REQ-IAM-007 NFR-02 DEC-133 a self-approval is possible only in Setup and shows on the Audit log as Self-approved', async ({
    page,
  }) => {
    await signIn(page, 'systemAdmin');
    // BR-03: while Live the System Admin's own SPK is not in its inbox.
    await page.goto('/approvals');
    await expect(page.getByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible();
    await expect(page.getByText('Loading…')).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Self approval check/ })).toHaveCount(0);

    await switchMode(page, 'Back to Setup');
    await page.goto('/approvals');
    await page
      .getByRole('row', { name: /Self approval check/ })
      .getByRole('link', { name: 'Open review' })
      .click();
    await expect(page.locator('.crumb')).toContainText(/SPK-\d/);
    const crumb = (await page.locator('.crumb').textContent()) ?? '';
    const spkNumber = crumb.replace('Approvals / ', '').trim();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Decided')).toBeVisible();

    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await menu.getByRole('link', { name: 'Audit log' }).click();
    await expect(page).toHaveURL(/\/audit-log$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    await expect(page.getByText(/^Page 1 of \d+ \(\d+ total\)$/)).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(spkNumber) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Yusuf E2E');
    await expect(row).toContainText('System Admin');
    await expect(row).toContainText('Pending_Approval');
    await expect(row).toContainText('Active');
    await expect(row).toContainText('Self-approved');

    await row.getByRole('button', { name: spkNumber }).click();
    const panel = page.getByRole('dialog', { name: 'Audit record' });
    await expect(panel).toContainText('"status": "Pending_Approval"');
    await expect(panel).toContainText('"status": "Active"');
    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(panel).toHaveCount(0);

    await switchMode(page, 'Go live');
  });

  test('DEC-74 Export follows the filters and downloads a CSV or an xlsx file', async ({
    page,
  }) => {
    await signIn(page, 'systemAdmin');
    await page.goto('/audit-log');
    await page.getByLabel('Area').selectOption('SPK');
    await expect(page.getByText(/^Page 1 of \d+ \(\d+ total\)$/)).toBeVisible();

    for (const format of ['csv', 'xlsx'] as const) {
      await page.getByRole('button', { name: 'Export' }).click();
      const dialog = page.getByRole('dialog', { name: 'Export' });
      await dialog.getByLabel(format).check();
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Export' }).click();
      expect((await download).suggestedFilename()).toMatch(
        new RegExp(`^audit-log-\\d{4}-\\d{2}-\\d{2}\\.${format}$`),
      );
      await expect(dialog).toHaveCount(0);
    }
  });
});
