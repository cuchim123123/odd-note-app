import type { Editor } from '@tiptap/react';
import { Bold, Code, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { NOTE_EDITOR_BUTTON_SPACER_CLASS, NOTE_EDITOR_TOOLBAR_BUTTON_CLASS, NOTE_EDITOR_TOOLBAR_CLASS } from '../constants/note-editor.constants';

type NoteEditorToolbarProps = {
  editor: Editor;
  readOnly: boolean;
  onInsertImage?: (() => void) | undefined;
};

export function NoteEditorToolbar({ editor, readOnly, onInsertImage }: NoteEditorToolbarProps) {
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

  return (
    <div className={NOTE_EDITOR_TOOLBAR_CLASS}>
      <Button type="button" size="icon" variant={isActive('bold') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleBold().run()} disabled={readOnly} aria-label="Bold">
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={isActive('italic') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={readOnly} aria-label="Italic">
        <Italic className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={isActive('underline') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={readOnly} aria-label="Underline">
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={isActive('strike') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleStrike().run()} disabled={readOnly} aria-label="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={isActive('code') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleCode().run()} disabled={readOnly} aria-label="Inline code">
        <Code className="h-4 w-4" />
      </Button>
      <div className={NOTE_EDITOR_BUTTON_SPACER_CLASS} />
      <Button type="button" size="icon" variant={isActive('bulletList') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={readOnly} aria-label="Bullet list">
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={isActive('orderedList') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={readOnly} aria-label="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={isActive('blockquote') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={readOnly} aria-label="Blockquote">
        <Quote className="h-4 w-4" />
      </Button>
      <div className={NOTE_EDITOR_BUTTON_SPACER_CLASS} />
      <Button type="button" size="icon" variant={isActive('link') ? 'default' : 'ghost'} className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={toggleLink} disabled={readOnly} aria-label="Insert link">
        <LinkIcon className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className={NOTE_EDITOR_TOOLBAR_BUTTON_CLASS} onClick={onInsertImage} disabled={readOnly || !onInsertImage} aria-label="Insert image">
        <ImageIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
