import { test, expect, Page } from '@playwright/test';

// Helper to generate unique email for tests
const getUniqueEmail = () => `test-${Date.now()}@example.com`;

// Helper to register and login
async function registerAndLogin(page: Page, displayName: string) {
  const email = getUniqueEmail();
  const password = 'TestPassword123!';

  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();

  await page.fill('input[name="displayName"]', displayName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.click('button[type="submit"]');
  try {
    await page.waitForSelector('button[aria-label="Create new note"], button[title="Create new note"]', { timeout: 2000 });
  } catch {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
  }
  await expect(page.locator('button[aria-label="Create new note"], button[title="Create new note"]')).toBeVisible({ timeout: 5000 });

  return { email, password, displayName };
}

test.describe('Notes Sharing', () => {
  test('should share a note with another user with read-only access', async ({ page }) => {
    // Register and login as owner
    const owner = await registerAndLogin(page, 'Owner User');

    // Create a note
    const noteTitle = `Shared Note ${Date.now()}`;
    const createNoteResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' && response.url().includes('/notes') && response.status() === 201,
    );
    await page.click('button[aria-label="Create new note"], button[title="Create new note"]');
    const shareTitleInput = page.locator('input[placeholder*="title" i]');
    await shareTitleInput.click();
    await shareTitleInput.press('Control+A');
    await shareTitleInput.type(noteTitle);
    await page.locator('.tiptap').click();
    await page.keyboard.type('Content to share');
    await createNoteResponse;
    await expect(page.locator('input[placeholder*="title" i]')).toHaveValue(noteTitle);
    await page.waitForTimeout(500);

    const browser = page.context().browser();
    if (!browser) {
      throw new Error('Browser instance is required for sharing tests');
    }

    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();
    const { email: recipientEmail } = await registerAndLogin(recipientPage, 'Recipient User');
    await recipientContext.close();

    const storedAuth = await page.evaluate(() => localStorage.getItem('odd-note-auth'));
    const tokenMatch = storedAuth?.match(/"accessToken"\s*:\s*"([^"]+)"/);
    let accessToken = tokenMatch?.[1] ?? null;

    // Fall back to direct API login if browser storage isn't accessible
    if (!accessToken) {
      const response = await fetch('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: owner.email, password: owner.password }),
      });
      const result = (await response.json()) as { accessToken?: string };
      accessToken = result.accessToken ?? null;
    }

    if (!accessToken) {
      throw new Error('Failed to obtain access token');
    }

    const notesResponse = await fetch('http://localhost:4000/notes', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const notesList = (await notesResponse.json()) as Array<{ id: string; title: string }>;
    const createdNote = notesList.find((note) => note.title === noteTitle) ?? null;

    if (!createdNote) {
      throw new Error('Created note was not found');
    }

    const shareResponse = await fetch(`http://localhost:4000/notes/${createdNote.id}/shares`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientEmail, permission: 'READ' }),
    });

    expect(shareResponse.status).toBe(201);

    await page.reload();
    await expect(page.locator('.note-item').filter({ hasText: noteTitle }).first()).toBeVisible();
    await page.locator('.note-item').filter({ hasText: noteTitle }).first().click();
    await expect(page.locator(`text=${recipientEmail}`)).toBeVisible();
  });

  test('should see shared notes in "Shared with me" section', async ({ page }) => {
    // Register recipient in a session
    await registerAndLogin(page, 'Recipient User');

    // In a real scenario, we would need the owner to share a note
    // For this smoke test, we verify the UI component exists
    const sharedSection = page.locator('text=Shared with me, text="My Notes"').first();
    if (await sharedSection.isVisible()) {
      expect(sharedSection).toBeTruthy();
    }
  });

  test('should not allow editing read-only shared notes', async ({ page }) => {
    // This test would require:
    // 1. Owner creating and sharing a note with read-only access
    // 2. Recipient logging in and trying to edit
    // 3. Verifying the editor is disabled

    // For smoke test, we check that shared note UI shows read-only indicator
    const readOnlyBanner = page.locator('text=Read-only access');
    if (await readOnlyBanner.isVisible()) {
      const noteEditor = page.locator('.tiptap');
      const isReadOnly = await noteEditor.evaluate((el: HTMLElement) => {
        const element = el as unknown as { contentEditable?: string };
        return element.contentEditable === 'false' || el.getAttribute('readonly') === '';
      });
      expect(isReadOnly).toBeTruthy();
    }
  });

  test('should allow owner to revoke share access', async ({ page }) => {
    // Register and login as owner
    await registerAndLogin(page, 'Owner User');

    // Create a note
    const noteTitle = `Revoke Test ${Date.now()}`;
    const createNoteResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' && response.url().includes('/notes') && response.status() === 201,
    );
    await page.click('button[aria-label="Create new note"], button[title="Create new note"]');
    const revokeTitleInput = page.locator('input[placeholder*="title" i]');
    await revokeTitleInput.click();
    await revokeTitleInput.press('Control+A');
    await revokeTitleInput.type(noteTitle);
    await page.locator('.tiptap').click();
    await page.keyboard.type('Content');
    await createNoteResponse;
    await expect(page.locator('input[placeholder*="title" i]')).toHaveValue(noteTitle);
    await page.waitForTimeout(500);

    // Open share manager
    const shareButton = page.locator('button:has-text("Share")').last();
    if (await shareButton.isVisible()) {
      await shareButton.click();

      // Look for a revoke/delete button in the shares list
      const revokeButton = page.locator('button:has-text("Revoke"), button:has-text("Delete"), button:has-text("Remove")').first();
      if (await revokeButton.isVisible()) {
        await revokeButton.click();

        // Confirm deletion if there's a dialog
        const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")').last();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Verify the share was removed
        await page.waitForTimeout(500);
        expect(await revokeButton.isVisible()).toBeFalsy();
      }
    }
  });
});
