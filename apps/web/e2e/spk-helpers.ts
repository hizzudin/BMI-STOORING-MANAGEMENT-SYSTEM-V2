import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { e2eAccount, type E2eAccount } from './accounts';

/** Signs in through the login page (the Planner unless another account is named). */
export async function signIn(page: Page, key: E2eAccount['key'] = 'planner') {
  const account = e2eAccount(key);
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * A vehicle made by the System Admin through the API in its own request context (no browser
 * cookies), so the spec does not depend on spec order.
 */
export async function addVehicle(request: APIRequestContext, origin: string, run: string) {
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
