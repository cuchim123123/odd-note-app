import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
}

import { beforeEach } from 'vitest';

beforeEach(() => {
  if (typeof indexedDB !== 'undefined') {
    indexedDB.deleteDatabase('odd-note-app');
  }
});
