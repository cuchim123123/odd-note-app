import { Extension } from '@tiptap/core';
import * as Y from 'yjs';
import { ySyncPlugin } from 'y-prosemirror';

export interface YjsExtensionOptions {
  yDoc?: Y.Doc | undefined;
  fragmentName?: string;
}

export const YjsExtension = Extension.create<YjsExtensionOptions>({
  name: 'yjs',

  addOptions() {
    return {
      yDoc: undefined,
      fragmentName: 'prosemirror',
    };
  },

  addProseMirrorPlugins() {
    const { yDoc, fragmentName } = this.options;
    if (!yDoc) {
      return [];
    }

    return [ySyncPlugin(yDoc.getXmlFragment(fragmentName ?? 'prosemirror'))];
  },
});
