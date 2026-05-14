import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useMemo, useRef } from 'react';
import { Bold, Code, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNotePreferencesStore } from '../../settings/stores/note-preferences.store';
import { cn } from '../../../lib/utils';
import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin } from '@tiptap/pm/state';

type RemoteCursor = {
  userId: string;
  displayName: string;
  color: string;
  position: number;
};

type NoteEditorProps = {
  content?: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  onInsertImage?: () => void;
  syncKey?: string | null;
  collaborative?: boolean;
  remoteCursors?: RemoteCursor[];
  onCursorMove?: (position: number) => void;
};

export function NoteEditor({ content = '', onChange, readOnly = false, onInsertImage, syncKey, collaborative = false, remoteCursors = [], onCursorMove }: NoteEditorProps) {
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);
  const remoteCursorRef = useRef(remoteCursors);
  remoteCursorRef.current = remoteCursors;

  const remoteCursorExtension = useMemo(() => Extension.create({
    name: 'remoteCursorIndicators',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const decorations = remoteCursorRef.current
                .filter((cursor) => Number.isFinite(cursor.position))
                .map((cursor) => {
                  const position = Math.max(1, Math.min(cursor.position, state.doc.content.size));
                  return Decoration.widget(
                    position,
                    () => {
                      const wrapper = document.createElement('span');
                      wrapper.className = 'pointer-events-none inline-flex translate-y-0.5 select-none items-center align-middle';

                      const caret = document.createElement('span');
                      caret.className = 'inline-block h-5 border-l-2';
                      caret.style.borderColor = cursor.color;

                      const label = document.createElement('span');
                      label.className = '-ml-px rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm';
                      label.style.backgroundColor = cursor.color;
                      label.textContent = cursor.displayName;

                      wrapper.appendChild(caret);
                      wrapper.appendChild(label);
                      return wrapper;
                    },
                    { key: cursor.userId },
                  );
                });

              return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null;
            },
          },
        }),
      ];
    },
  }), []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      remoteCursorExtension,
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
    onSelectionUpdate: ({ editor }) => {
      if (!readOnly && collaborative && onCursorMove) {
        onCursorMove(editor.state.selection.from);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none max-w-none min-h-[320px] prose-headings:tracking-tight prose-p:leading-7 prose-li:leading-7 prose-blockquote:border-primary/20 prose-blockquote:text-foreground prose-pre:bg-slate-950 prose-pre:text-slate-50',
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

  const toolbarButtonClass = 'h-10 w-10 rounded-full';

  useEffect(() => {
    if (!editor) return;

    const syncKeyChanged = syncKey !== undefined && lastSyncKeyRef.current !== syncKey;

    if (syncKeyChanged) {
      lastSyncKeyRef.current = syncKey ?? null;
      editor.commands.setContent(content, false);
      return;
    }

    if (collaborative && content !== editor.getHTML()) {
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content, false);
      const maxPos = editor.state.doc.content.size;
      const safeFrom = Math.min(from, maxPos);
      const safeTo = Math.min(to, maxPos);
      try {
        editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
      } catch {
        // ignore if position is invalid after content change
      }
    }
  }, [editor, content, syncKey, collaborative]);

  if (!editor) {
    return null;
  }

  return (
    <div
      data-testid="note-editor"
      data-note-font-size={noteFontSize}
      aria-readonly={readOnly}
      className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
    >
      <div className="border-b border-border/70 bg-gradient-to-r from-slate-50 to-white px-3 py-3 sm:px-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pr-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <Button type="button" size="icon" variant={isActive('bold') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={readOnly} aria-label="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant={isActive('italic') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={readOnly} aria-label="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant={isActive('underline') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={readOnly} aria-label="Underline">
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant={isActive('strike') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={readOnly} aria-label="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant={isActive('code') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleCode().run()} disabled={readOnly} aria-label="Inline code">
            <Code className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button type="button" size="icon" variant={isActive('bulletList') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={readOnly} aria-label="Bullet list">
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant={isActive('orderedList') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={readOnly} aria-label="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant={isActive('blockquote') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={readOnly} aria-label="Blockquote">
            <Quote className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button type="button" size="icon" variant={isActive('link') ? 'default' : 'ghost'} className={toolbarButtonClass} onClick={toggleLink} disabled={readOnly} aria-label="Insert link">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className={toolbarButtonClass} onClick={onInsertImage} disabled={readOnly || !onInsertImage} aria-label="Insert image">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <EditorContent
        editor={editor}
        className={cn('prose focus:outline-none max-w-none px-4 py-4 sm:px-5', 'min-h-[240px] sm:min-h-[320px]')}
      />
    </div>
  );
}
