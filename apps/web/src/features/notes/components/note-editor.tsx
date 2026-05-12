import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { useNotePreferencesStore } from '../../settings/stores/note-preferences.store';
import { cn } from '../../../lib/utils';

type NoteEditorProps = {
  content?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
};

export function NoteEditor({ content = '', onChange, readOnly = false }: NoteEditorProps) {
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your note here...',
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert focus:outline-none max-w-none min-h-[300px]',
      },
    },
  });

  useEffect(() => {
    if (!editor || !editor.view?.dom) {
      return;
    }

    const dom = editor.view.dom;
    dom.classList.remove('prose-sm', 'prose-base', 'prose-lg');
    dom.classList.add(noteFontSize === 'sm' ? 'prose-sm' : noteFontSize === 'lg' ? 'prose-lg' : 'prose-base');
  }, [editor, noteFontSize]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Sync content if it changes externally (e.g., when selecting a different note)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      data-testid="note-editor"
      data-note-font-size={noteFontSize}
      aria-readonly={readOnly}
      className="w-full border rounded-md p-4 bg-background"
    >
      {/* TODO: Add formatting toolbar here later */}
      <EditorContent
        editor={editor}
        className={cn('prose dark:prose-invert focus:outline-none max-w-none min-h-[300px]')}
      />
    </div>
  );
}
