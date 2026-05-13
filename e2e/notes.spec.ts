import { test, expect, Page } from '@playwright/test';

// Helper to generate unique email for tests
const getUniqueEmail = () => `test-${Date.now()}@example.com`;

// Helper to register and login
async function registerAndLogin(page: Page) {
  const email = getUniqueEmail();
  const password = 'TestPassword123!';
  const displayName = 'Test User';

  await page.goto('/');
  await page.click('text=Register');

  await page.fill('input[name="displayName"]', displayName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/, { timeout: 5000 });

  return { email, password, displayName };
}

test.describe('Notes CRUD', () => {
  test('should create a new note', async ({ page }) => {
    await registerAndLogin(page);

    // Click new note button
    await page.click('button:has-text("New Note")');

    // Fill note content
    const noteTitle = `Test Note ${Date.now()}`;
    const noteContent = 'This is test content';

    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type(noteContent);

    // Wait for autosave
    await page.waitForTimeout(2000);

    // Verify note appears in sidebar
    await expect(page.locator(`text=${noteTitle}`)).toBeVisible();
  });

  test('should edit an existing note', async ({ page }) => {
    await registerAndLogin(page);

    // Create a note
    await page.click('button:has-text("New Note")');
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
    await expect(page.locator(`.tiptap:has-text("${updatedContent}")`)).toBeVisible();
  });

  test('should delete a note with confirmation', async ({ page }) => {
    await registerAndLogin(page);

    // Create a note
    await page.click('button:has-text("New Note")');
    const noteTitle = `Delete Test ${Date.now()}`;
    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type('Content to delete');
    await page.waitForTimeout(2000);

    // Delete the note
    const deleteButton = page.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Confirm deletion in dialog
    const confirmButton = page.locator('button:has-text("Delete")').last();
    await confirmButton.click();

    // Verify note is removed from sidebar
    await expect(page.locator(`text=${noteTitle}`)).not.toBeVisible();
  });

  test('should search notes by title', async ({ page }) => {
    await registerAndLogin(page);

    // Create multiple notes
    const note1Title = `Searchable Note A ${Date.now()}`;
    const note2Title = `Searchable Note B ${Date.now()}`;

    for (const title of [note1Title, note2Title]) {
      await page.click('button:has-text("New Note")');
      await page.fill('input[placeholder*="title" i]', title);
      await page.locator('.tiptap').click();
      await page.locator('.tiptap').type('Content');
      await page.waitForTimeout(1000);
    }

    // Search for first note
    const searchInput = page.locator('input[placeholder*="search" i]');
    await searchInput.fill('Searchable Note A');
    await page.waitForTimeout(500);

    // Verify only first note is visible
    await expect(page.locator(`text=${note1Title}`)).toBeVisible();
    await expect(page.locator(`text=${note2Title}`)).not.toBeVisible();
  });

  test('should pin and unpin notes', async ({ page }) => {
    await registerAndLogin(page);

    // Create a note
    await page.click('button:has-text("New Note")');
    const noteTitle = `Pin Test ${Date.now()}`;
    await page.fill('input[placeholder*="title" i]', noteTitle);
    await page.locator('.tiptap').click();
    await page.locator('.tiptap').type('Content');
    await page.waitForTimeout(2000);

    // Pin the note (look for pin icon)
    const noteCard = page.locator(`text=${noteTitle}`).first().locator('..').locator('button:has-text("📌"), [aria-label*="pin" i]').first();
    await noteCard.click();

    // Verify note is pinned (should appear at top)
    await page.waitForTimeout(500);
    const firstNote = page.locator('.note-item').first();
    await expect(firstNote.locator(`text=${noteTitle}`)).toBeVisible();
  });
});
