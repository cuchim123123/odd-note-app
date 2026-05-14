import { Page } from '@playwright/test';

const API_BASE_URL = 'http://localhost:4000';

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Generate a unique email for test isolation
 */
export function getUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@example.com`;
}

/**
 * Register a new test user via the frontend and return credentials
 */
export async function registerUser(
  page: Page,
  displayName: string,
): Promise<TestUser> {
  const email = getUniqueEmail();
  const password = 'TestPassword123!';

  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();

  await page.fill('input[name="displayName"]', displayName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.click('button[type="submit"]');

  // Wait for navigation to complete after registration
  await page.waitForURL(/\/(notes|auth)/, { timeout: 5000 });

  return { email, password, displayName };
}

/**
 * Login a test user via the test endpoint to get tokens
 */
export async function loginViaTestEndpoint(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/test/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
  };

  if (!result.accessToken) {
    throw new Error('No access token in login response');
  }

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? '',
  };
}

/**
 * Register and login a test user, returning credentials and tokens
 */
export async function registerAndLogin(
  page: Page,
  displayName: string,
): Promise<TestUser> {
  const user = await registerUser(page, displayName);

  try {
    const tokens = await loginViaTestEndpoint(user.email, user.password);
    user.accessToken = tokens.accessToken;
    user.refreshToken = tokens.refreshToken;
  } catch {
    // If test endpoint fails, the user is already logged in via the frontend
    // No need to fail the entire test
    console.warn('Test endpoint unavailable, using frontend auth only');
  }

  return user;
}

/**
 * Get the current user info via API using an access token
 */
export async function getCurrentUser(
  accessToken: string,
): Promise<{ id: string; email: string; displayName: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Get current user failed: ${response.status}`);
  }

  return (await response.json()) as {
    id: string;
    email: string;
    displayName: string;
  };
}

/**
 * Create a note via API
 */
export async function createNoteViaApi(
  accessToken: string,
  title: string,
  content: string = '',
): Promise<{ id: string; title: string; content: string }> {
  const response = await fetch(`${API_BASE_URL}/notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, content }),
  });

  if (!response.ok) {
    throw new Error(`Create note failed: ${response.status}`);
  }

  return (await response.json()) as { id: string; title: string; content: string };
}

/**
 * Share a note with another user via API
 */
export async function shareNoteViaApi(
  accessToken: string,
  noteId: string,
  recipientEmail: string,
  permission: 'READ' | 'EDIT',
): Promise<{ id: string; recipientEmail: string; permission: string }> {
  const response = await fetch(
    `${API_BASE_URL}/notes/${noteId}/shares`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientEmail, permission }),
    },
  );

  if (!response.ok) {
    throw new Error(`Share note failed: ${response.status}`);
  }

  return (await response.json()) as {
    id: string;
    recipientEmail: string;
    permission: string;
  };
}

/**
 * Get all notes for a user via API
 */
export async function getNotesViaApi(
  accessToken: string,
): Promise<Array<{ id: string; title: string; content: string }>> {
  const response = await fetch(`${API_BASE_URL}/notes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Get notes failed: ${response.status}`);
  }

  return (await response.json()) as Array<{
    id: string;
    title: string;
    content: string;
  }>;
}
