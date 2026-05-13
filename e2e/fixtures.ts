import { test as base, expect } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type TestFixtures = {
  // Add custom fixtures here if needed
};

export const test = base.extend<TestFixtures>({
  // Add custom fixtures setup here if needed
});

export { expect };
