import { expect, test } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-APR-06 (TASK-122, REQ-APR-007, DEC-128): History lists past decisions with the reason and the
// stamp; Open SPK opens SPKDetail. The SPK comes from the e2e database seed (DEC-126).
test.describe('FLW-APR-06 Look back and follow up', () => {
  test('REQ-APR-007 ApprovalsHistory lists past decisions with reasons and stamps', async ({
    page,
  }) => {
    await signIn(page, 'supervisor');
    await page.goto('/approvals');
    await page
      .getByRole('row', { name: /Look back at me/ })
      .getByRole('link', { name: 'Open review' })
      .click();
    // NFR-15, DEC-104: the number reads SPK-yymmddNNNN (read once the review has loaded).
    await expect(page.locator('.crumb')).toContainText(/SPK-\d/);
    const spkNumber = ((await page.locator('.crumb').textContent()) ?? '')
      .replace('Approvals / ', '')
      .trim();
    expect(spkNumber).toMatch(/^SPK-\d{6}\d{4,}$/);
    await page.getByLabel('Reason (required to reject)').fill('No budget this month');
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('Decided')).toBeVisible();

    await page.goto('/approvals');
    await page.getByRole('link', { name: 'History' }).click();
    await expect(page).toHaveURL(/\/approvals\/history$/);
    await page.getByRole('button', { name: 'Rejected' }).click();
    const row = page.getByRole('row', { name: new RegExp(spkNumber) });
    await expect(row).toContainText('Supervisor Budi E2E');
    await row.click();
    const preview = page.getByRole('region', { name: 'Preview' });
    await expect(preview.getByText('Rejected by Supervisor: Budi E2E')).toBeVisible();
    await expect(preview.getByText('No budget this month')).toBeVisible();
    await preview.getByRole('link', { name: 'Open SPK' }).click();
    await expect(page.getByText(`Surat Perintah Kerja / ${spkNumber}`)).toBeVisible();
  });
});
