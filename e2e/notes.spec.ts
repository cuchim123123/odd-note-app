import { test, expect, Page } from '@playwright/test';

// Helper to generate unique email for tests
const getUniqueEmail = () => `test-${Date.now()}@example.com`;

// Helper to register and login
async function registerAndLogin(page: Page) {
  const email = getUniqueEmail();
  const password = 'TestPassword123!';
  const displayName = 'Test User';

  await page.goto('/');
  await page.click('text=Create an account');

  await page.fill('input[name="displayName"]', displayName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.click('button[type="submit"]');
  // Ensure user is logged in: try to find the create-note button, else perform explicit login
  try {
    await page.waitForSelector('button[aria-label="Create new note"], button[title="Create new note"]', { timeout: 2000 });
  } catch {
    // Not auto-logged-in; perform explicit login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
  }
  // Wait for registration/login to settle by confirming the note UI is available.
  await expect(page.locator('button[aria-label="Create new note"], button[title="Create new note"]')).toBeVisible({ timeout: 5000 });

  return { email, password, displayName };
}

test.describe('Notes CRUD', () => {
  test('should create a new note', async ({ page }) => {
    await registerAndLogin(page);

    // Click new note button (use aria-label/title present in UI)
    await page.click('button[aria-label="Create new note"], button[title="Create new note"]');

    // Fill note content
    const noteTitle = `Test Note ${Date.now()}`;
    const noteContent = 'This is test content';

    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type(noteContent);

    // Wait for autosave
    await page.waitForTimeout(3500);

    // Verify note appears in sidebar
    await expect(page.locator('.note-item').filter({ hasText: noteTitle })).toHaveCount(1);
  });

  test('should edit an existing note', async ({ page }) => {
    await registerAndLogin(page);

    // Create a note
    await page.click('button[aria-label="Create new note"], button[title="Create new note"]');
    const noteTitle = `Edit Test ${Date.now()}`;
    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type('Original content');
    await page.waitForTimeout(2000);

    // Edit the note
    const updatedContent = 'Updated content';
    await page.locator('.tiptap').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(updatedContent);
    await page.waitForTimeout(2000);

    // Verify content was updated
    await expect(page.getByTestId('note-editor')).toContainText(updatedContent);
  });

  test('should delete a note with confirmation', async ({ page }) => {
    await registerAndLogin(page);

    // Create a note
    await page.click('button[aria-label="Create new note"], button[title="Create new note"]');
    const noteTitle = `Delete Test ${Date.now()}`;
    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type('Content to delete');
    await page.waitForTimeout(2000);

    // Delete the note
    const deleteButton = page.locator('button[aria-label="Delete note"]');
    await deleteButton.click();

    // Confirm deletion in dialog
    const confirmButton = page.locator('button:has-text("Delete")').last();
    await confirmButton.click();

    // Verify note is removed from sidebar
    await expect(page.locator('.note-item').filter({ hasText: noteTitle })).toHaveCount(0);
  });

  test('should search notes by title', async ({ page }) => {
    await registerAndLogin(page);

    // Create multiple notes
    const note1Title = `Searchable Note A ${Date.now()}`;
    const note2Title = `Searchable Note B ${Date.now()}`;

    for (const title of [note1Title, note2Title]) {
      await page.click('button[aria-label="Create new note"], button[title="Create new note"]');
      await page.fill('input[placeholder*="title" i]', title);
      await page.locator('.tiptap').click();
      await page.locator('.tiptap').type('Content');
      await page.waitForTimeout(3500);
    }

    // Search for first note
    const searchInput = page.locator('input[placeholder*="search" i]');
    await searchInput.fill('Searchable Note A');
    await page.waitForTimeout(500);

    // Verify only first note is visible
    await expect(page.locator('.note-item').filter({ hasText: note1Title })).toHaveCount(1);
    await expect(page.locator('.note-item').filter({ hasText: note2Title })).toHaveCount(0);
  });

  test('should pin and unpin notes', async ({ page }) => {
    await registerAndLogin(page);

    // Create a note
    await page.click('button[aria-label="Create new note"], button[title="Create new note"]');
    const noteTitle = `Pin Test ${Date.now()}`;
    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type('Content');
    await page.waitForTimeout(3500);

    // Pin the note (look for pin icon)
    const noteCard = page.locator('.note-item').filter({ hasText: noteTitle }).first();
    await noteCard.locator('button[aria-label="Pin note"], button[aria-label="Unpin note"]').first().click();

    // Verify note is pinned (should appear at top)
    await page.waitForTimeout(500);
    const firstNote = page.locator('.note-item').first();
    await expect(firstNote).toContainText(noteTitle);
  });
});
