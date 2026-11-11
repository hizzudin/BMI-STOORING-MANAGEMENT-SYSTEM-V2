import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-SA-01 and FLW-SA-03 as far as TASK-119 goes (DEC-122): add a vehicle, edit it with a
// reason, deactivate it. The baseline, documents and odometer readings come with their tasks.
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page) {
  const admin = e2eAccount('systemAdmin');
  await page.goto('/login');
  await page.getByLabel('Email').fill(admin.email);
  await page.getByLabel('Password').fill(admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A class made through the same session, so the spec does not depend on spec order. */
async function addClass(page: Page, code: string, name: string, towed: boolean) {
  const origin = new URL(page.url()).origin;
  const created = await page.request.post('/api/vehicle-classes', {
    headers: { Origin: origin },
    data: {
      code,
      name,
      unitKind: towed ? 'Towed' : 'Powered',
      definition: towed
        ? { frontDrawing: 'Kingpin', spareCount: 1, axles: [{ role: 'Trailer', tyresPerSide: 2 }] }
        : {
            frontDrawing: 'Fifth_wheel',
            spareCount: 1,
            axles: [
              { role: 'Steer', tyresPerSide: 1 },
              { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
            ],
          },
    },
  });
  expect(created.status()).toBe(201);
}

test.describe('Vehicles', () => {
  test('FLW-SA-01 REQ-VEH-002 AC-PLC-008 the System Admin adds a vehicle; a trailer has no odometer field', async ({
    page,
  }, testInfo) => {
    // Unique per attempt: a retry finds the records of the failed attempt already saved.
    const run = `${Date.now().toString(36)}${testInfo.retry}`.toUpperCase();
    const head = `Head ${run}`;
    const tail = `Tail ${run}`;
    await signIn(page);
    await addClass(page, `Head_${run}`, head, false);
    await addClass(page, `Tail_${run}`, tail, true);

    await page.goto('/vehicles');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vehicles');
    await page.getByRole('link', { name: 'Add vehicle' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add vehicle');

    await page.getByLabel('Class').selectOption({ label: tail });
    await expect(page.getByLabel('Odometer km')).toHaveCount(0);
    await expect(page.getByLabel('Axles and tyres')).toHaveValue('1 axle · 4 tyres + 1 spare');

    await page.getByLabel('Class').selectOption({ label: head });
    await expect(page.getByLabel('Axles and tyres')).toHaveValue('2 axles · 6 tyres + 1 spare');
    await page.getByLabel('Plate').fill(`B ${run}`);
    await page.getByLabel('Odometer km').fill('12.400');
    await page.getByLabel('Brand').fill('Hino');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`B ${run}`);
    await expect(page.getByText(`${head} · 12.400 km`)).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: `Chassis map, B ${run}` })).toBeVisible();

    await page.goto('/vehicles');
    await expect(page.getByRole('row', { name: new RegExp(`B ${run}`) })).toContainText(
      '12.400 km',
    );
  });

  test('FLW-SA-03 REQ-VEH-003 REQ-VEH-004 an edit with a reason, then a deactivation with a reason', async ({
    page,
  }, testInfo) => {
    const run = `${Date.now().toString(36)}${testInfo.retry}`.toUpperCase();
    await signIn(page);
    await addClass(page, `Edit_${run}`, `Edit head ${run}`, false);

    await page.goto('/vehicles/new');
    await page.getByLabel('Class').selectOption({ label: `Edit head ${run}` });
    await page.getByLabel('Plate').fill(`B ${run}`);
    await page.getByLabel('Odometer km').fill('500');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`B ${run}`);

    await page.getByRole('link', { name: 'Edit vehicle' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit vehicle');
    await page.getByLabel('Engine number').fill('4D56-AB1234');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.refusal')).toHaveText('Give a reason.');
    await page.getByLabel('Reason for the change').fill('Wrong engine number at entry');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`B ${run}`);

    await page.getByRole('link', { name: 'Edit vehicle' }).click();
    await expect(page.getByLabel('Engine number')).toHaveValue('4D56-AB1234');
    await page.getByRole('button', { name: 'Deactivate vehicle' }).click();
    const dialog = page.getByRole('dialog', { name: `Deactivate B ${run}?` });
    await dialog.getByLabel('Reason').fill('Sold');
    await dialog.getByRole('button', { name: 'Deactivate' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`B ${run}`);
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible();
    // History stays readable; an Inactive vehicle has nothing left to edit.
    await expect(page.getByRole('link', { name: 'Edit vehicle' })).toHaveCount(0);
    await page.goto('/vehicles');
    await page.getByRole('tab', { name: 'Inactive' }).click();
    await expect(page.getByRole('row', { name: new RegExp(`B ${run}`) })).toBeVisible();
  });
});
