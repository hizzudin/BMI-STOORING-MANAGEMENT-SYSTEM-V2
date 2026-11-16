import { expect, test, type Page } from '@playwright/test';
import { signIn } from './spk-helpers';

// FLW-PLN-03 (TASK-123, REQ-SPK-007, AC-SPK-005, T5, T6, DEC-129): the Planner reads why its SPK
// was rejected, resubmits one and cancels the other. The e2e seed holds both, rejected by the
// Supervisor, with their steps (DEC-126: no step composer before TASK-207).
test.describe.configure({ mode: 'serial' });

/** Opens the Planner's rejected SPK with this title from the Rejected tab of SPKList. */
async function openRejected(page: Page, title: string): Promise<string> {
  await page.goto('/spk');
  await page.getByRole('tab', { name: /^Rejected/ }).click();
  await page.getByLabel('Search SPK, plate, title').fill(title);
  const row = page.getByRole('row', { name: /SPK-\d{10}/ });
  await expect(row).toHaveCount(1);
  // DEC-129: SPKRejected shows the reason, so Waiting on names the creator again.
  await expect(row).toContainText('Planner Planner E2E');
  await row.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/spk\/\d+$/);
  const crumb = page.locator('.crumb');
  await expect(crumb).toContainText(/SPK-\d{10}/);
  return ((await crumb.textContent()) ?? '').replace('Surat Perintah Kerja / ', '').trim();
}

test.describe('FLW-PLN-03 Rejected SPK', () => {
  test('AC-SPK-005 T5 SPKRejected shows the reason; Edit and resubmit sends it for approval again', async ({
    page,
  }) => {
    await signIn(page, 'planner');
    const spkNumber = await openRejected(page, 'Resubmit me');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Resubmit me');
    await expect(page.getByText(/^Rejected by Supervisor Budi E2E · /)).toBeVisible();
    await expect(page.getByText('Wrong vehicle: use the trailer head')).toBeVisible();
    await expect(page.getByText('SPK document')).toHaveCount(0);

    await page.getByRole('link', { name: 'Edit and resubmit' }).click();
    await expect(page).toHaveURL(/\/spk\/\d+\/edit$/);
    await expect(page.getByText('Wrong vehicle: use the trailer head')).toBeVisible();
    await page.getByLabel('Title').fill('Resubmit me with the trailer head');
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.getByText('Pending approval', { exact: true }).first()).toBeVisible();

    await page.goto('/spk');
    await page.getByRole('tab', { name: /^Pending approval/ }).click();
    await expect(page.getByRole('row', { name: new RegExp(spkNumber) })).toBeVisible();
  });

  test('T6 DEC-129 Cancel SPK asks for a reason and lands on the Cancelled tab', async ({
    page,
  }) => {
    await signIn(page, 'planner');
    const spkNumber = await openRejected(page, 'Cancel me');
    await page.getByRole('button', { name: 'Cancel SPK' }).click();
    const dialog = page.getByRole('dialog', { name: `Cancel ${spkNumber}?` });
    await expect(dialog.getByRole('button', { name: 'Cancel SPK' })).toBeDisabled();
    await dialog.getByLabel('Reason').fill('Raised twice');
    await dialog.getByRole('button', { name: 'Cancel SPK' }).click();

    await expect(page).toHaveURL(/\/spk\?tab=cancelled$/);
    await expect(page.getByRole('tab', { name: /^Cancelled/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const row = page.getByRole('row', { name: new RegExp(spkNumber) });
    await expect(row).toContainText('Cancelled');
  });
});
