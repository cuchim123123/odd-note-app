import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { NoteEditor } from '@/features/notes/components/note-editor';
import { useNotePreferencesStore } from '@/features/settings/stores/note-preferences.store';

const resetFontPreference = () => {
  useNotePreferencesStore.getState().setNoteFontSize('base');
};

beforeEach(() => {
  resetFontPreference();
});

afterEach(() => {
  cleanup();
});

// Mock TipTap to simulate editor behavior without testing internals
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react');

  type MockEditor = {
    getHTML: () => string;
    setEditable: () => void;
    commands: {
      setContent: (newHtml: string) => void;
    };
  };

  return {
    ...actual,
    useEditor: (opts: { content?: string }) => {
      // mutable HTML container for this mock editor instance
      let html = opts?.content ?? '';

      const editor: MockEditor = {
        setEditable: vi.fn(),
        commands: {
          setContent: (newHtml: string) => {
            html = newHtml;
          },
        },
        getHTML: () => html,
      };

      return editor;
    },
    EditorContent: ({ editor }: { editor: { getHTML: () => string } }) => {
      // Render the editor's HTML so tests can assert visible content (behavior-driven)
      return <div data-testid="editor-content" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />;
    },
  };
});

describe('NoteEditor — observable behavior', () => {
  it('renders initial content and updates visible HTML when content prop changes; exposes readOnly state', () => {
    const { getByTestId, rerender } = render(<NoteEditor content="<p>first</p>" readOnly={false} />);

    const wrapper = getByTestId('note-editor');
    const content = getByTestId('editor-content');

    expect(wrapper).toBeTruthy();
    expect(wrapper.getAttribute('aria-readonly')).toBe('false');
    expect(content.innerHTML).toContain('<p>first</p>');

    // Update props to simulate external content change and readOnly flip.
    rerender(<NoteEditor content="<p>second</p>" readOnly={true} />);

    expect(wrapper.getAttribute('aria-readonly')).toBe('true');
    expect(content.innerHTML).toContain('<p>second</p>');
  });

  it('exposes the selected note font size in the editor wrapper', () => {
    useNotePreferencesStore.getState().setNoteFontSize('lg');

    const { getByTestId } = render(<NoteEditor content="<p>Text</p>" readOnly={false} />);

    expect(getByTestId('note-editor')).toHaveAttribute('data-note-font-size', 'lg');
  });

  it('should not throw when changing between readOnly states', () => {
    const { rerender } = render(
      <NoteEditor
        content="<p>Text</p>"
        onChange={() => {}}
        readOnly={false}
      />
    );

    // Should not error when re-rendering with different readOnly state
    expect(() => {
      rerender(
        <NoteEditor
          content="<p>Text</p>"
          onChange={() => {}}
          readOnly={true}
        />
      );
    }).not.toThrow();
  });
});
