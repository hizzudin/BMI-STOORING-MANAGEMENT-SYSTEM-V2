import { expect, test } from '@playwright/test';
import { addVehicle, signIn } from './spk-helpers';

// FLW-PLN-01 as far as TASK-125 goes (DEC-126, DEC-127): the Planner opens Create SPK from a vehicle,
// saves a draft and submits it; Submit is refused until the step composer (TASK-207) adds a step. The
// draft then shows in the Draft tab of SPKList, where Open returns to Create SPK.
test.describe.configure({ mode: 'serial' });

test.describe('Create SPK', () => {
  test('FLW-PLN-01 REQ-SPK-001 REQ-SPK-010 DEC-126 DEC-127 from a vehicle: Save draft, Submit refused without a step, then in the Draft tab', async ({
    page,
    request,
  }, testInfo) => {
    // Unique per attempt: a retry finds the records of the failed attempt already saved.
    const run = `${Date.now().toString(36)}${testInfo.retry}`.toUpperCase();
    await signIn(page);
    const vehicleId = await addVehicle(request, new URL(page.url()).origin, run);

    await page.goto(`/vehicles/${vehicleId}`);
    await page.getByRole('link', { name: 'Create SPK' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create SPK');
    await expect(page.getByLabel('Vehicle', { exact: true })).toHaveValue(String(vehicleId));

    await page.getByLabel('Title').fill('PM 20.000 km');
    await page.getByLabel('Category').selectOption('PM');
    await page.getByLabel('Urgency').selectOption('High');
    await page.getByLabel('Description').fill('Service per PM package TH-20K.');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await expect(page).toHaveURL(/\/spk\/\d+\/edit\?saved=1$/);
    await expect(page.getByText('Saved.')).toBeVisible();
    const crumb = page.getByText(/Surat Perintah Kerja \/ SPK-\d{10,}/);
    await expect(crumb).toBeVisible();
    const spkNumber = ((await crumb.textContent()) ?? '').split(' / ')[1] ?? '';
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.locator('.refusal')).toHaveText('Add at least one step before submitting.');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await page.goto('/spk');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Surat Perintah Kerja');
    await expect(page.getByRole('link', { name: 'Create SPK' })).toHaveAttribute(
      'href',
      '/spk/new',
    );
    await page.getByRole('tab', { name: /^Draft/ }).click();
    const row = page.getByRole('row').filter({ hasText: spkNumber });
    await expect(row).toContainText(`B ${run}`);
    await expect(row).toContainText('High');
    await row.getByRole('link', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/spk\/\d+\/edit$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create SPK');
  });
});
