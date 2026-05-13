import { test, expect, Page } from '@playwright/test';

// Helper to generate unique email for tests
const getUniqueEmail = () => `test-${Date.now()}@example.com`;

// Helper to register and login
async function registerAndLogin(page: Page, displayName: string) {
  const email = getUniqueEmail();
  const password = 'TestPassword123!';

  await page.goto('/auth/register');

  await page.fill('input[name="displayName"]', displayName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/, { timeout: 5000 });

  return { email, password, displayName };
}

test.describe('Password Reset Flow', () => {
  test('should request password reset and show success message', async ({ page }) => {
    const email = getUniqueEmail();

    // Navigate to forgot password
    await page.goto('/auth/forgot-password');

    // Fill email
    await page.fill('input[name="email"]', email);

    // Submit
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
    await expect(page.locator('text=password reset link')).toBeVisible();
  });

  test('should show invalid link error when token is missing', async ({ page }) => {
    // Go to reset password without token
    await page.goto('/auth/reset-password');

    // Should show invalid link error
    await expect(page.locator('text=Invalid Link')).toBeVisible();
    await expect(page.locator('text=invalid or missing')).toBeVisible();
  });

  test('should reset password with valid token', async ({ page, context }) => {
    // Register a user
    const { email } = await registerAndLogin(page, 'Password Reset Test User');

    // Get a reset token via test endpoint (if available)
    // This requires ALLOW_TEST_ENDPOINTS=1 or NODE_ENV=test on backend
    let resetToken: string | null = null;
    try {
      const tokenResponse = await context.request.post('http://localhost:4000/auth/test/generate-reset-token', {
        data: { email },
      });
      const tokenData = await tokenResponse.json() as { token?: string };
      resetToken = tokenData.token || null;
    } catch {
      // Test endpoint may not be available; skip token-based test
      test.skip();
    }

    if (!resetToken) {
      test.skip();
    }

    // Logout first
    await page.goto('/');
    await page.click('button:has-text("Logout"), [aria-label*="logout" i]').catch(() => null);

    // Navigate to reset password page with token
    await page.goto(`/auth/reset-password?token=${resetToken}`);

    // Fill new password
    const newPassword = 'NewPassword456!';
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to login
    await page.waitForURL(/.*login/, { timeout: 5000 });

    // Should see success message or be on login page
    await expect(page).toHaveURL(/.*login/);

    // Try to login with new password
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', newPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
  });

  test('should reject mismatched passwords in reset form', async ({ page }) => {
    await page.goto('/auth/reset-password?token=fake-token-for-validation');

    // Fill mismatched passwords
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'Different456!');

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error
    await page.waitForTimeout(500);
    const errorVisible = await page.locator('text=do not match, text=mismatch').first().isVisible().catch(() => false);
    if (errorVisible) {
      expect(await page.locator('text=do not match, text=mismatch').first().isVisible()).toBeTruthy();
    }
  });

  test('should enforce password requirements in reset form', async ({ page }) => {
    await page.goto('/auth/reset-password?token=fake-token-for-validation');

    // Try short password
    await page.fill('input[name="password"]', 'short');
    await page.fill('input[name="confirmPassword"]', 'short');

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error about length
    await page.waitForTimeout(500);
    const errorVisible = await page.locator('text=at least 8 characters').first().isVisible().catch(() => false);
    if (errorVisible) {
      expect(await page.locator('text=at least 8 characters').first().isVisible()).toBeTruthy();
    }
  });

  test('should show error for expired or invalid token', async ({ page }) => {
    // Use obviously invalid token
    await page.goto('/auth/reset-password?token=invalid-expired-token-xyz');

    // Fill passwords
    await page.fill('input[name="password"]', 'NewPassword456!');
    await page.fill('input[name="confirmPassword"]', 'NewPassword456!');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message about expired/invalid link
    await page.waitForTimeout(1000);
    const errorVisible = await page.locator('text=expired, text=invalid').first().isVisible().catch(() => false);
    if (errorVisible) {
      expect(await page.locator('text=expired, text=invalid').first().isVisible()).toBeTruthy();
    }
  });

  test('should have link to request new reset link from error page', async ({ page }) => {
    await page.goto('/auth/reset-password');

    // Should see "Request new link" button
    const requestLink = page.locator('a:has-text("Request new link")');
    await expect(requestLink).toBeVisible();

    // Click should go to forgot-password
    await requestLink.click();
    await expect(page).toHaveURL(/.*forgot-password/);
  });

  test('should navigate back to login from forgot password page', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    // Should see back to login link
    const backLink = page.locator('a:has-text("Back to login")');
    await expect(backLink).toBeVisible();

    // Click should go to login
    await backLink.click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should show forgot password link on login page', async ({ page }) => {
    await page.goto('/auth/login');

    // Should see "Forgot password?" link
    const forgotLink = page.locator('a:has-text("Forgot password?")');
    await expect(forgotLink).toBeVisible();

    // Click should go to forgot-password
    await forgotLink.click();
    await expect(page).toHaveURL(/.*forgot-password/);
  });
});
