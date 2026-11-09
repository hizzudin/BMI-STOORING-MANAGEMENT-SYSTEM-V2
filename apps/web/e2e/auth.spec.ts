import { expect, test, type Page } from '@playwright/test';
import { e2eAccount } from './accounts';

// `e2e auth` of TASK-104: REQ-IAM-001, REQ-IAM-009, NFR-05, DEC-102 in a real browser against the API.
// Next.js keeps its own empty role=alert route announcer, so the form's refusal is found by its class.
const refusal = (page: Page) => page.locator('p.refusal');

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('auth', () => {
  test('REQ-IAM-001 signs in and keeps the session in HttpOnly cookies', async ({
    page,
    context,
  }) => {
    const planner = e2eAccount('planner');
    await signIn(page, planner.email, planner.password);
    await expect(page).toHaveURL('/');
    const me = await page.request.get('/api/me');
    expect((await me.json()) as unknown).toMatchObject({
      user: { email: planner.email, role: 'Planner' },
    });
    const cookies = await context.cookies();
    expect(cookies.map((cookie) => cookie.name).sort()).toEqual(['bmi_access', 'bmi_refresh']);
    for (const cookie of cookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe('Strict');
    }
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });

  test('REQ-IAM-009 the first sign-in asks for a new password, then the new one signs in', async ({
    page,
  }) => {
    const mechanic = e2eAccount('firstSignIn');
    await signIn(page, mechanic.email, mechanic.password);
    await expect(page).toHaveURL('/change-password');
    await expect(page.getByLabel('Current password')).toHaveCount(0);
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Repeat new password').fill('short');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(refusal(page)).toHaveText('At least 8 characters with letters and digits.');
    await page.getByLabel('New password', { exact: true }).fill('newmechanic2026');
    await page.getByLabel('Repeat new password').fill('newmechanic2026');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL('/');
    await page.context().clearCookies();
    await signIn(page, mechanic.email, 'newmechanic2026');
    await expect(page).toHaveURL('/');
  });

  test('REQ-IAM-001 NFR-05 five wrong passwords lock the account', async ({ page }) => {
    const korlap = e2eAccount('locked');
    await page.goto('/login');
    await page.getByLabel('Email').fill(korlap.email);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await page.getByLabel('Password').fill(`wrong${attempt}pass`);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(refusal(page)).toBeVisible();
    }
    await expect(refusal(page)).toContainText('This account is locked after 5 failed sign-ins');
    await page.getByLabel('Password').fill(korlap.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(refusal(page)).toContainText('locked');
    await expect(page).toHaveURL('/login');
  });

  test('DEC-102 Forgot password answers the same way and leads back to sign in', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
    await page.getByLabel('Email').fill('nobody@e2e.test');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'If an account uses this address, a reset link is on its way. Check your email.',
    );
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL('/login');
  });
});
