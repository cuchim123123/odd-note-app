import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Collaboration from '@tiptap/extension-collaboration';
import { useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';
import { useNotePreferencesStore, noteColorClasses } from '../../settings/stores/note-preferences.store';
import { cn } from '../../../lib/utils';
import { NoteEditorToolbar } from './note-editor-toolbar';
import {
  NOTE_EDITOR_CONTENT_CLASS,
  NOTE_EDITOR_EDITABLE_CLASS,
  NOTE_EDITOR_HEADER_CLASS,
  NOTE_EDITOR_PLACEHOLDER,
  NOTE_EDITOR_WRAPPER_CLASS,
} from '../constants/note-editor.constants';

import type { Editor } from '@tiptap/react';

type NoteEditorProps = {
  content?: string | undefined;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  onInsertImage?: () => void;
  syncKey?: string | null;
  collaborative?: boolean;
  yDoc?: Y.Doc | undefined;
  isOwner?: boolean;
  isSynced?: boolean;
  onEditorInit?: (editor: Editor) => void;
};

export function NoteEditor({
  content = '',
  onChange,
  readOnly = false,
  onInsertImage,
  syncKey,
  collaborative = false,
  yDoc,
  isOwner = false,
  isSynced = false,
  onEditorInit,
}: NoteEditorProps) {
  const noteFontSize = useNotePreferencesStore((state) => state.noteFontSize);
  const noteColor = useNotePreferencesStore((state) => state.noteColor);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

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

  const editor = useEditor({
    extensions: [
      starterKit,
      Underline,
      Image,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
        },
      }),
      Placeholder.configure({
        placeholder: NOTE_EDITOR_PLACEHOLDER,
      }),
      ...collaborationExtensions,
    ],
    ...(yDoc ? {} : { content }),
    editable: !readOnly,
    onCreate: ({ editor: ed }) => {

      const extensionNames = ed.extensionManager.extensions.map((extension) => extension.name);
      const pluginKeys = ed.state.plugins.map((plugin) => String((plugin as { key?: string }).key ?? ''));
      console.warn('[NoteEditor] created', {
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
    },
    editorProps: {
      attributes: {
        class: NOTE_EDITOR_EDITABLE_CLASS,
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorInit) {
      onEditorInit(editor);
    }
  }, [editor, onEditorInit]);

  // Seeding logic: ONLY the owner should seed empty Yjs documents after initial sync is complete
  useEffect(() => {
    if (collaborative && isOwner && yDoc && content && isSynced && editor) {
      const fragment = yDoc.getXmlFragment('prosemirror');
      if (fragment.length === 0) {
        console.warn('[NoteEditor] Owner seeding empty Yjs document after initial sync');
        editor.commands.setContent(content, false);
      }
    }
  }, [collaborative, isOwner, yDoc, content, isSynced, editor]);

  useEffect(() => {
    if (!editor || !editor.view?.dom) {
      return;
    }

    const dom = editor.view.dom;
    dom.classList.remove('prose-sm', 'prose-base', 'prose-lg');
    dom.classList.add(noteFontSize === 'sm' ? 'prose-sm' : noteFontSize === 'lg' ? 'prose-lg' : 'prose-base');
    dom.classList.add('dark:prose-invert');
  }, [editor, noteFontSize]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;

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
      className={cn(NOTE_EDITOR_WRAPPER_CLASS, noteColorClasses[noteColor].editor)}
    >
      <div className={NOTE_EDITOR_HEADER_CLASS}>
        <NoteEditorToolbar editor={editor} readOnly={readOnly} onInsertImage={onInsertImage} />
      </div>
      <EditorContent
        editor={editor}
        className={cn(NOTE_EDITOR_CONTENT_CLASS, 'min-h-[240px]', 'sm:min-h-[320px]', 'bg-transparent')}
      />
    </div>
  );
}
