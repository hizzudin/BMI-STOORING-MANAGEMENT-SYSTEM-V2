import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-PLN-01 as far as TASK-121 goes (DEC-126): the Planner opens Create SPK from a vehicle, saves a
// draft and submits it; Submit is refused until the step composer (TASK-207) adds a step.
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page) {
  const planner = e2eAccount('planner');
  await page.goto('/login');
  await page.getByLabel('Email').fill(planner.email);
  await page.getByLabel('Password').fill(planner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * A vehicle made by the System Admin through the API in its own request context (no browser
 * cookies), so the spec does not depend on spec order.
 */
async function addVehicle(request: APIRequestContext, origin: string, run: string) {
  const admin = e2eAccount('systemAdmin');
  const signedIn = await request.post('/api/auth/sign-in', {
    headers: { Origin: origin },
    data: { email: admin.email, password: admin.password, client: 'mobile' },
  });
  expect(signedIn.status()).toBe(200);
  const { accessToken } = (await signedIn.json()) as { accessToken: string };
  const headers = { Origin: origin, authorization: `Bearer ${accessToken}` };
  const created = await request.post('/api/vehicle-classes', {
    headers,
    data: {
      code: `Spk_Head_${run}`,
      name: `SPK head ${run}`,
      unitKind: 'Powered',
      definition: {
        frontDrawing: 'None',
        spareCount: 0,
        axles: [{ role: 'Steer', tyresPerSide: 1 }],
      },
    },
  });
  expect(created.status()).toBe(201);
  const { vehicleClass } = (await created.json()) as { vehicleClass: { id: number } };
  const vehicle = await request.post('/api/vehicles', {
    headers,
    data: {
      licensePlate: `B ${run}`,
      vin: null,
      engineNumber: null,
      brand: null,
      model: null,
      year: null,
      fuelType: null,
      vehicleClassId: vehicleClass.id,
      odometer: 48210,
    },
  });
  expect(vehicle.status()).toBe(201);
  return ((await vehicle.json()) as { vehicle: { id: number } }).vehicle.id;
}

test.describe('Create SPK', () => {
  test('FLW-PLN-01 REQ-SPK-001 DEC-126 from a vehicle: Save draft, then Submit refused without a step', async ({
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
    await expect(page.getByText(/Surat Perintah Kerja \/ SPK-\d{10,}/)).toBeVisible();
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
  });
});
