import { Extension } from '@tiptap/core';
import * as Y from 'yjs';
import { yXmlFragmentToProseMirrorRootNode, proseMirrorToYXmlFragment } from 'y-prosemirror';

declare global {
  interface Window {
    Y: typeof Y;
  }
}

export interface YjsExtensionOptions {
  yDoc: Y.Doc;
  mapping?: Map<unknown, unknown>;
}

export const YjsExtension = Extension.create<YjsExtensionOptions>({
  name: 'yjs',

  addOptions() {
    return {
      yDoc: null as unknown as Y.Doc,
      mapping: new Map(),
    };
  },

  addStorage() {
    return {
      yXmlFragment: null as unknown as Y.XmlFragment,
    };
  },

  onBeforeCreate() {
    const { yDoc } = this.options;
    if (!yDoc) {
      console.warn('YjsExtension: yDoc not provided');
      return;
    }

    // Get or create shared XML fragment
    const yXmlFragment = yDoc.getXmlFragment('shared');
    this.storage.yXmlFragment = yXmlFragment;

    // Initialize with existing content if available
    const editor = this.editor;
    try {
      const pmNode = yXmlFragmentToProseMirrorRootNode(yDoc, yXmlFragment, {
        mapping: this.options.mapping,
      });

      if (pmNode && pmNode.content.size > 0) {
        // Document has content from Yjs, use it
        editor.commands.setContent(pmNode.toJSON());
      }
    } catch (error) {
      console.warn('YjsExtension: Failed to load content from Y.Doc', error);
    }
  },

  onUpdate() {
    const { yDoc } = this.options;
    if (!yDoc) {
      return;
    }

    const yXmlFragment = this.storage.yXmlFragment as Y.XmlFragment;
    const editor = this.editor;

    try {
      proseMirrorToYXmlFragment(
        editor.state.doc,
        yXmlFragment,
        this.options.mapping,
        yDoc.clientID
      );
    } catch (error) {
      console.warn('YjsExtension: Failed to sync content to Y.Doc', error);
    }
  },

  addKeyboardShortcuts() {
    return {};
  },
});
