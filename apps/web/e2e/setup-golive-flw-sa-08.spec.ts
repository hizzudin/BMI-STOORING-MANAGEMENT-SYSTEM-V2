import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';
import { signIn } from './spk-helpers';

// FLW-SA-08 (TASK-111, DEC-132): the e2e database starts Live. The System Admin goes back to Setup,
// a Planner is refused at sign-in, the System Admin goes live again, and the Planner signs in. The
// run ends Live, so the other specs are unaffected.
test.describe.configure({ mode: 'serial' });

async function tryPlannerSignIn(page: Page) {
  const planner = e2eAccount('planner');
  await page.goto('/login');
  await page.getByLabel('Email').fill(planner.email);
  await page.getByLabel('Password').fill(planner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('FLW-SA-08 Set up and go live', () => {
  test('AC-IAM-006 REQ-IAM-010 DEC-132 Back to Setup refuses the Planner; Go live lets it in again', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'systemAdmin');
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await menu.getByRole('link', { name: 'Setup and go live' }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Setup and go live' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Setup' }).click();
    const back = page.getByRole('dialog', { name: 'Back to Setup mode?' });
    const confirmBack = back.getByRole('button', { name: 'Back to Setup' });
    await back.getByLabel('Reason').fill('Re-import the parts catalog');
    await back.getByLabel('Type BACK TO SETUP to confirm').fill('BACK TO');
    await expect(confirmBack).toBeDisabled();
    await back.getByLabel('Type BACK TO SETUP to confirm').fill('BACK TO SETUP');
    await confirmBack.click();
    await expect(back).toHaveCount(0);
    await expect(page.getByText('Setup mode', { exact: true })).toBeVisible();
    await expect(page.getByText('Accounts')).toBeVisible();

    const planner = await browser.newPage();
    await tryPlannerSignIn(planner);
    await expect(planner.getByText('The system is being set up.')).toBeVisible();
    await expect(planner).toHaveURL(/\/login/);

    await page.getByRole('button', { name: 'Go live' }).click();
    const live = page.getByRole('dialog', { name: 'Go live?' });
    await live.getByLabel('Reason').fill('Parts catalog re-imported');
    await live.getByLabel('Type GO LIVE to confirm').fill('GO LIVE');
    await live.getByRole('button', { name: 'Go live' }).click();
    await expect(live).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to Setup' })).toBeVisible();

    await tryPlannerSignIn(planner);
    await expect(planner).not.toHaveURL(/\/login/);
    await planner.close();
  });
});
