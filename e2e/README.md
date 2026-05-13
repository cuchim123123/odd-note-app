# E2E Tests with Playwright

This directory contains end-to-end tests for the odd-note-app using Playwright.

## Overview

The test suite covers smoke tests for:

- **Authentication** (`auth.spec.ts`): User registration, login, and authentication flows
- **Notes CRUD** (`notes.spec.ts`): Creating, editing, deleting, searching, and pinning notes
- **Sharing** (`sharing.spec.ts`): Note sharing with recipients and permission management

## Prerequisites

Before running tests, ensure:

1. **Docker is running** (API runs in a container)

   ```bash
   docker compose up -d api
   ```

2. **Dependencies are installed**
   ```bash
   pnpm install
   ```

## Running Tests

### Run all tests

```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive)

```bash
pnpm test:e2e:ui
```

This opens an interactive test runner where you can see tests run in real-time and debug.

### Run tests in debug mode

```bash
pnpm test:e2e:debug
```

This opens the Playwright Inspector for step-by-step debugging.

### Run specific test file

```bash
npx playwright test e2e/auth.spec.ts
```

### Run tests matching a pattern

```bash
npx playwright test -g "should create a new note"
```

## Configuration

The Playwright configuration is defined in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173` (frontend dev server)
- **API URL**: `http://localhost:4000` (backend API)
- **Browsers**: Chromium, Firefox, WebKit
- **Auto-start servers**: The config automatically starts both frontend dev server and Docker API

## Test Structure

Each test file follows this pattern:

1. **Helper functions** for common operations (e.g., `registerAndLogin`)
2. **Test suites** grouped by feature (e.g., `test.describe('Auth Flow')`)
3. **Individual tests** with clear assertions

### Example Test

```typescript
test('should create a new note', async ({ page }) => {
  // Setup: Register and login
  await registerAndLogin(page);

  // Action: Create a note
  await page.click('button:has-text("New Note")');
  await page.fill('input[placeholder*="title"]', 'Test Note');

  // Assert: Verify the note appears
  await expect(page.locator('text=Test Note')).toBeVisible();
});
```

## Debugging

### View test report

After running tests, open the HTML report:

```bash
npx playwright show-report
```

### Slow down execution

Use the `--headed` flag to see the browser:

```bash
npx playwright test --headed
```

### Single test in headed mode

```bash
npx playwright test e2e/auth.spec.ts --headed
```

## Common Issues

### Tests timeout waiting for server

Ensure Docker and dev server are running:

```bash
docker compose up -d api
pnpm --filter @odd-note-app/web dev
```

### Email validation in tests

Tests generate unique emails using `getUniqueEmail()` helper to avoid conflicts.

### Flaky tests

Use explicit waits instead of fixed timeouts:

```typescript
await page.waitForURL(/.*dashboard/, { timeout: 5000 });
```

## Best Practices

1. **Use semantic locators** (`text=`, `role=`, `aria-label=`) instead of CSS selectors
2. **Wait for navigation** before asserting page content changed
3. **Generate unique test data** to avoid conflicts between test runs
4. **Keep tests independent** — each test should be able to run in any order
5. **Use helpers** for common flows like login to reduce duplication

## Next Steps

- [ ] Add more detailed integration tests
- [ ] Test real-time collaboration features (WebSocket)
- [ ] Add performance/load testing
- [ ] Integrate with CI/CD pipeline
- [ ] Add visual regression testing
