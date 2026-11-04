import { expect, test } from '@playwright/test';

test.describe('E2E harness', () => {
  test('opens the web app in a browser', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('BMI Stooring System');
    await expect(page.getByRole('main')).toHaveText('BMI Stooring System');
  });
});
