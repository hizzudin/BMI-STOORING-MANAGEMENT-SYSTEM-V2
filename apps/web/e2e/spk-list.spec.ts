import { expect, test, type APIRequestContext } from '@playwright/test';
import { e2eAccount } from './accounts';
import { addVehicle, signIn } from './spk-helpers';

// REQ-SPK-010, REQ-SPK-011, DEC-127: another user with spk.view finds the Planner's draft by its
// plate and reads it on SPKDetail; an account without spk.view is refused.
test.describe.configure({ mode: 'serial' });

/** A draft saved by the Planner through the API, as Create SPK saves it. */
async function addDraft(request: APIRequestContext, origin: string, vehicleId: number) {
  const planner = e2eAccount('planner');
  const signedIn = await request.post('/api/auth/sign-in', {
    headers: { Origin: origin },
    data: { email: planner.email, password: planner.password, client: 'mobile' },
  });
  expect(signedIn.status()).toBe(200);
  const { accessToken } = (await signedIn.json()) as { accessToken: string };
  const created = await request.post('/api/spks', {
    headers: { Origin: origin, authorization: `Bearer ${accessToken}` },
    data: {
      vehicleId,
      title: 'Brake check',
      category: 'Corrective',
      priority: 'Urgent',
      requiresDowntime: true,
      description: 'Brake pedal feels soft.',
    },
  });
  expect(created.status()).toBe(201);
  return ((await created.json()) as { spk: { spkNumber: string } }).spk.spkNumber;
}

test.describe('SPKList and SPKDetail', () => {
  test('REQ-SPK-010 REQ-SPK-011 DEC-127 search by plate, View opens the read-only detail', async ({
    page,
    request,
  }, testInfo) => {
    const run = `${Date.now().toString(36)}${testInfo.retry}`.toUpperCase();
    await signIn(page, 'systemAdmin');
    const origin = new URL(page.url()).origin;
    const vehicleId = await addVehicle(request, origin, run);
    const spkNumber = await addDraft(request, origin, vehicleId);
    const planner = e2eAccount('planner');

    await page.goto('/spk');
    await page.getByRole('tab', { name: /^Draft/ }).click();
    await page.getByLabel('Search SPK, plate, title').fill(run);
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(spkNumber);
    await expect(rows.first()).toContainText('Urgent');
    await expect(rows.first()).toContainText(`Planner ${planner.name}`);
    await expect(page.getByText('Page 1 of 1 (1 total)')).toBeVisible();

    // Not its creator: the System Admin may not edit this draft, so the row offers View.
    await rows.first().getByRole('link', { name: 'View' }).click();
    await expect(page).toHaveURL(/\/spk\/\d+$/);
    await expect(page.getByText(`Surat Perintah Kerja / ${spkNumber}`)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brake check');
    await expect(page.getByText(`created by Planner ${planner.name}`)).toBeVisible();
    await expect(page.getByText('No steps yet.')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Cost' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText('Nothing has happened yet.')).toBeVisible();
  });

  test('REQ-SPK-010 an account without spk.view is refused', async ({ page }) => {
    await signIn(page, 'accounting');
    await page.goto('/spk');
    // NAV-9: the shell refuses a page outside the capability set before the list asks the API.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not allowed');
    await expect(page.getByText('You do not have permission to open this page.')).toBeVisible();
  });
});
