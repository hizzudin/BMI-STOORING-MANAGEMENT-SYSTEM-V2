import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// FLW-SA-02 step 4 of TASK-118: the System Admin maintains document types.
test.describe.configure({ mode: 'serial' });

const panel = (page: Page) => page.getByRole('region', { name: 'Document type' });
const row = (page: Page, name: string | RegExp) => page.getByRole('row', { name });

test.describe('Document types', () => {
  test('FLW-SA-02 REQ-DOC-001 REQ-DOC-002 DEC-121 the launch types, an edit, a new type and a deactivation', async ({
    page,
  }, testInfo) => {
    // Unique per attempt: a retry finds the records of the failed attempt already saved.
    const run = `${Date.now().toString(36)}${testInfo.retry}`;
    const className = `Doc test rigid ${run}`;
    const typeName = `Izin trayek ${run}`;
    const admin = e2eAccount('systemAdmin');
    await page.goto('/login');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // A class the types can be required for, made through the same session (any spec order).
    const origin = new URL(page.url()).origin;
    const created = await page.request.post('/api/vehicle-classes', {
      headers: { Origin: origin },
      data: {
        code: `Doc_Test_${run}`,
        name: className,
        unitKind: 'Powered',
        definition: {
          frontDrawing: 'None',
          spareCount: 0,
          axles: [{ role: 'Steer', tyresPerSide: 1 }],
        },
      },
    });
    expect(created.status()).toBe(201);

    await page.goto('/settings/document-types');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Document types');
    for (const name of ['STNK annual', 'STNK five-year', 'KIR', 'Insurance']) {
      await expect(row(page, new RegExp(`^${name}`))).toBeVisible();
    }

    await row(page, /^KIR/).click();
    await panel(page).getByLabel('Warning days').fill('45');
    await panel(page).getByLabel(className).check();
    await panel(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved.');
    await expect(row(page, /^KIR/)).toContainText(className);
    await expect(row(page, /^KIR/)).toContainText('45');

    await page.getByRole('button', { name: 'New document type' }).click();
    await panel(page).getByLabel('Code').fill(`Izin_Trayek_${run}`);
    await panel(page).getByLabel('Name').fill(typeName);
    await panel(page).getByLabel('Usual validity (months)').fill('60');
    await panel(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved.');
    await expect(row(page, new RegExp(`^${typeName}`))).toContainText('60 months');

    await panel(page).getByRole('button', { name: 'Deactivate' }).click();
    await page
      .getByRole('dialog', { name: `Deactivate ${typeName}?` })
      .getByRole('button', { name: 'Deactivate' })
      .click();
    await expect(row(page, new RegExp(`^${typeName}`))).toHaveCount(0);
  });
});
