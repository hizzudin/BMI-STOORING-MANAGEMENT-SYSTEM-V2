import { expect, test } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-APR-01 (TASK-122): a Supervisor approves one SPK and rejects another; the SPKs come from the
// e2e database seed, with their steps (DEC-126: no step composer before TASK-207).
test.describe.configure({ mode: 'serial' });

test.describe('FLW-APR-01 Approve SPK creation', () => {
  test('T3 AC-SPK-002 REQ-APR-001 Approvals → Creation → ApprovalReview → Approve: stamp, Active, step 1 Open', async ({
    page,
  }) => {
    await signIn(page, 'supervisor');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await expect(menu.getByRole('link', { name: /^Approvals, \d+ waiting$/ })).toBeVisible();
    await menu.getByRole('link', { name: /^Approvals/ }).click();
    await expect(page).toHaveURL(/\/approvals$/);

    await page.getByRole('button', { name: 'Creation' }).click();
    const row = page.getByRole('row', { name: /SPK-E2E-APR-01/ });
    await row.getByText('Approve me').click();
    const preview = page.getByRole('region', { name: 'Preview' });
    await expect(preview.getByText('SPK-E2E-APR-01')).toBeVisible();
    await expect(preview.getByText('1 Stock · Warehouse Manager')).toBeVisible();
    await row.getByRole('link', { name: 'Open review' }).click();

    await expect(page).toHaveURL(/\/approvals\/spk\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creation review');
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Approved by Supervisor: Budi E2E')).toBeVisible();
    await expect(page.getByText('Decided')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);

    const spkId = page.url().split('/').pop();
    await page.goto(`/spk/${spkId}`);
    await expect(page.getByText('Surat Perintah Kerja / SPK-E2E-APR-01')).toBeVisible();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Waiting to start since/)).toBeVisible();
    await expect(page.getByText('Opens when step 1 is submitted')).toBeVisible();
  });

  test('T4 AC-SPK-005 C-25 Reject needs a reason; the SPK goes back to its creator with it', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'supervisor');
    await page.goto('/approvals');
    await page
      .getByRole('row', { name: /SPK-E2E-APR-02/ })
      .getByRole('link', { name: 'Open review' })
      .click();
    const reject = page.getByRole('button', { name: 'Reject' });
    await expect(reject).toBeDisabled();
    await page.getByLabel('Reason (required to reject)').fill('Wrong vehicle');
    await reject.click();
    await expect(page.getByText('Rejected by Supervisor: Budi E2E')).toBeVisible();
    await expect(page.getByText('Wrong vehicle')).toBeVisible();

    const planner = await browser.newPage();
    await signIn(planner, 'planner');
    await planner.goto('/spk');
    await planner.getByRole('tab', { name: /^Rejected/ }).click();
    await expect(planner.getByRole('row', { name: /SPK-E2E-APR-02/ })).toContainText(
      'Rejected: Wrong vehicle',
    );
    await planner.close();
  });
});
