import { expect, test } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-SA-06 (TASK-110): the System Admin approves an SPK it submitted itself (BR-03), then finds the
// decision on the Audit log flagged Self-approved; the SPK comes from the e2e database seed.
test.describe.configure({ mode: 'serial' });

test.describe('FLW-SA-06 Oversight', () => {
  test('REQ-IAM-007 NFR-02 a self-approval shows on the Audit log as Self-approved, with its detail', async ({
    page,
  }) => {
    await signIn(page, 'systemAdmin');
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
