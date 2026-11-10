import { expect, test } from '@playwright/test';

test.describe('E2E harness', () => {
  test('opens the web app in a browser; without a session the home page goes to sign in', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
    await expect(page).toHaveTitle('BMI Stooring System');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('BMI Stooring System');
  });
});
