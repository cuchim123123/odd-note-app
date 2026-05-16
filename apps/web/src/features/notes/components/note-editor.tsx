import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Collaboration from '@tiptap/extension-collaboration';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { Bold, Code, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNotePreferencesStore } from '../../settings/stores/note-preferences.store';
import { cn } from '../../../lib/utils';

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
  yDoc?: Y.Doc | undefined;
};

export function NoteEditor({ content = '', onChange, readOnly = false, onInsertImage, syncKey, collaborative = false, remoteCursors = [], onCursorMove, yDoc }: NoteEditorProps) {
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const lastLocalCursorPositionRef = useRef<number | null>(null);
  const collaborativeSeededForSessionRef = useRef(false);
  const lastFragmentLengthRef = useRef<number | null>(null);
  const [remoteCursorAnchors, setRemoteCursorAnchors] = useState<Array<RemoteCursor & { top: number; left: number }>>([]);

  const starterKit = useMemo(
    () => StarterKit.configure(collaborative && Boolean(yDoc) ? { history: false } : {}),
    [collaborative, yDoc],
  );
  const collaborationExtensions = useMemo(() => (yDoc
    ? [
        Collaboration.configure({
          document: yDoc,
          field: 'prosemirror',
        }),
      ]
    : []), [yDoc]);

  const emitCursorPosition = useCallback((position: number) => {
    if (!readOnly && collaborative && onCursorMove && lastLocalCursorPositionRef.current !== position) {
      lastLocalCursorPositionRef.current = position;
      onCursorMove(position);
    }
  }, [collaborative, onCursorMove, readOnly]);

  const editor = useEditor({
    extensions: [
      starterKit,
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
      ...collaborationExtensions,
    ],
    ...(yDoc ? {} : { content }),
    editable: !readOnly,
    onCreate: ({ editor: ed }) => {
      const extensionNames = ed.extensionManager.extensions.map((extension) => extension.name);
      const pluginKeys = ed.state.plugins.map((plugin) => String((plugin as { key?: string }).key ?? ''));
      console.log('[NoteEditor] created', {
        collaborative,
        hasYDoc: Boolean(yDoc),
        syncKey,
        fragmentLength: yDoc?.getXmlFragment('prosemirror').length ?? null,
        extensionNames,
        pluginKeys,
      });
    },
    onUpdate: ({ editor: ed }) => {
      if (onChange) {
        onChange(ed.getHTML());
      }

      if (collaborative && yDoc) {
        const fragmentLength = yDoc.getXmlFragment('prosemirror').length;
        console.log('[NoteEditor] onUpdate fragment length', {
          previous: lastFragmentLengthRef.current,
          current: fragmentLength,
          syncKey,
        });
        lastFragmentLengthRef.current = fragmentLength;
      }

      emitCursorPosition(ed.state.selection.from);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      emitCursorPosition(ed.state.selection.from);
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

  useEffect(() => {
    if (!editor || !yDoc || !collaborative) {
      return;
    }

    if (collaborativeSeededForSessionRef.current) {
      return;
    }

    const fragment = yDoc.getXmlFragment('prosemirror');
    console.log('[NoteEditor] collaborative seed check', {
      syncKey,
      fragmentLength: fragment.length,
      contentLength: content.length,
      seeded: collaborativeSeededForSessionRef.current,
    });
    if (fragment.length > 0) {
      collaborativeSeededForSessionRef.current = true;
      return;
    }

    if (!content) {
      return;
    }

    collaborativeSeededForSessionRef.current = true;
    editor.commands.setContent(content, false);
    const fragmentLengthAfter = yDoc.getXmlFragment('prosemirror').length;
    console.log('[NoteEditor] collaborative seed applied', {
      syncKey,
      fragmentLengthAfter,
    });
    if (fragmentLengthAfter === 0 && content) {
      console.warn('[NoteEditor] collaborative seed did not mutate Y.Doc', {
        syncKey,
        contentLength: content.length,
      });
    }
  }, [collaborative, content, editor, yDoc]);

  const recalculateRemoteCursorAnchors = useCallback(() => {
    if (!editorContainerRef.current || !editor) {
      setRemoteCursorAnchors([]);
      return;
    }

    const containerRect = editorContainerRef.current.getBoundingClientRect();
    const nextAnchors = remoteCursors
      .filter((cursor) => Number.isFinite(cursor.position))
      .map((cursor) => {
        const position = Math.max(1, Math.min(cursor.position, editor.state.doc.content.size));
        const coords = editor.view.coordsAtPos(position);

        return {
          ...cursor,
          top: coords.top - containerRect.top,
          left: coords.left - containerRect.left,
        };
      });

    setRemoteCursorAnchors(nextAnchors);
  }, [editor, remoteCursors]);

  useEffect(() => {
    recalculateRemoteCursorAnchors();
  }, [recalculateRemoteCursorAnchors, content, remoteCursors, noteFontSize, readOnly]);

  useEffect(() => {
    const handleViewportChange = () => {
      recalculateRemoteCursorAnchors();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [recalculateRemoteCursorAnchors]);

  useEffect(() => {
    lastLocalCursorPositionRef.current = null;
    collaborativeSeededForSessionRef.current = false;
    lastFragmentLengthRef.current = null;
  }, [syncKey]);

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
      if (!collaborative) {
        editor.commands.setContent(content, false);
      }
      return;
    }

    if (!collaborative && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
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
      ref={editorContainerRef}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
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
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        {remoteCursorAnchors.map((cursor) => (
          <div
            key={cursor.userId}
            className="absolute z-20"
            style={{ left: cursor.left, top: cursor.top }}
          >
            <span
              className="absolute left-0 top-0 h-5 border-l-2"
              style={{ borderColor: cursor.color }}
            />
            <span
              className="absolute left-2 -top-6 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
