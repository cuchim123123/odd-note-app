import { test, expect } from '@playwright/test';

// Helper to generate unique email for each test run
const getUniqueEmail = () => `test-${Date.now()}@example.com`;

test.describe('Auth Flow', () => {
  test('should register a new account and log in', async ({ page }) => {
    const email = getUniqueEmail();
    const password = 'TestPassword123!';
    const displayName = 'Test User';

    // Navigate to app
    await page.goto('/');

    // Should be redirected to login if not authenticated
    await expect(page).toHaveURL(/.*login/);

    // Click register link (match actual UI text)
    await page.click('text=Create an account');

    // Fill registration form
    await page.fill('input[name="displayName"]', displayName);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    // Submit form
    await page.click('button[type="submit"]');

    // App may redirect to dashboard or to root; ensure registration completed
    // by waiting for the unverified-account banner to appear
    await expect(page.locator('text=Your account is not verified')).toBeVisible({ timeout: 5000 });
  });

  test('should show login form when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Login form inputs should be visible
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('should reject invalid login credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Should stay on login page or show error
    await page.waitForTimeout(1000);
    const isStillOnLogin = page.url().includes('login') || page.locator('text=error').count() > 0;
    expect(isStillOnLogin).toBeTruthy();
  });
});
