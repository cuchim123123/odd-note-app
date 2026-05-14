import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useRef } from 'react';
import { Bold, Code, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNotePreferencesStore } from '../../settings/stores/note-preferences.store';
import { cn } from '../../../lib/utils';

type NoteEditorProps = {
  content?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  onInsertImage?: () => void;
  // Optional stable key (e.g. note id) that signals when external content
  // should replace the editor contents. If omitted, the editor will only
  // sync content on initial mount.
  syncKey?: string | null;
};

export function NoteEditor({ content = '', onChange, readOnly = false, onInsertImage, syncKey }: NoteEditorProps) {
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
        },
      }),
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

  // Sync content if it changes externally (e.g., when selecting a different note).
  // Only perform the replacement when `syncKey` changes or on initial mount to
  // avoid clobbering in-progress edits from transient updates.
  const lastSyncKeyRef = useRef<string | null>(null);

  const isActive = (name: string) => Boolean(editor?.isActive?.(name));

  const toggleLink = () => {
    if (!editor || readOnly) {
      return;
    }

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter a link URL', previousUrl ?? 'https://');

    if (!url) {
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const toolbarButtonClass = 'h-9 w-9';

  useEffect(() => {
    if (!editor) return;

    const isInitial = lastSyncKeyRef.current === null;
    const syncKeyChanged = syncKey !== undefined && lastSyncKeyRef.current !== syncKey;

    if ((isInitial || syncKeyChanged) && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
      lastSyncKeyRef.current = syncKey ?? null;
    }
  }, [editor, content, syncKey]);

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
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b pb-3">
        <Button type="button" size="icon" variant={isActive('bold') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={readOnly} aria-label="Bold">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant={isActive('italic') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={readOnly} aria-label="Italic">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant={isActive('underline') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={readOnly} aria-label="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant={isActive('strike') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={readOnly} aria-label="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant={isActive('code') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleCode().run()} disabled={readOnly} aria-label="Inline code">
          <Code className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button type="button" size="icon" variant={isActive('bulletList') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={readOnly} aria-label="Bullet list">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant={isActive('orderedList') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={readOnly} aria-label="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant={isActive('blockquote') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={readOnly} aria-label="Blockquote">
          <Quote className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button type="button" size="icon" variant={isActive('link') ? 'secondary' : 'ghost'} className={toolbarButtonClass} onClick={toggleLink} disabled={readOnly} aria-label="Insert link">
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className={toolbarButtonClass} onClick={onInsertImage} disabled={readOnly || !onInsertImage} aria-label="Insert image">
          <ImageIcon className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className={cn('prose dark:prose-invert focus:outline-none max-w-none min-h-[300px]')}
      />
    </div>
  );
}
