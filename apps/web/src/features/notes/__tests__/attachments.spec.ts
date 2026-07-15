import { describe, it, expect } from 'vitest';

import { appendImageToContent } from '@/features/notes/utils/attachments';

describe('Attachment helper', () => {
  it('creates image markup for empty content', () => {
    expect(appendImageToContent('', 'data:image/png;base64,abc')).toBe(
      '<p><img src="data:image/png;base64,abc" alt="Attached image" /></p>',
    );
  });

  it('appends image markup after existing content', () => {
    expect(appendImageToContent('<p>Hello</p>', 'data:image/png;base64,abc', 'Screenshot')).toContain(
      '<img src="data:image/png;base64,abc" alt="Screenshot" />',
    );
  });
});
