import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import type { IDocumentEnginePort } from '@modules/notes/application/ports/external/document-engine.port';

@Injectable()
export class YjsDocumentEngineAdapter implements IDocumentEnginePort {
  createInitialContent(content: string): Uint8Array {
    const ydoc = new Y.Doc();
    const xml = ydoc.getXmlFragment('prosemirror');
    const paragraph = new Y.XmlElement('paragraph');
    paragraph.insert(0, [new Y.XmlText(content)]);
    xml.insert(0, [paragraph]);
    
    return Y.encodeStateAsUpdate(ydoc);
  }

  applyUpdate(state: Uint8Array | undefined, update: Uint8Array): Uint8Array {
    const doc = new Y.Doc();
    if (state) {
      Y.applyUpdate(doc, state);
    }
    Y.applyUpdate(doc, update);
    return Y.encodeStateAsUpdate(doc);
  }

  computeDiff(currentState: Uint8Array, targetState: Uint8Array): Uint8Array {
    const currentDoc = new Y.Doc();
    Y.applyUpdate(currentDoc, currentState);

    const targetDoc = new Y.Doc();
    Y.applyUpdate(targetDoc, targetState);

    const currentStateVector = Y.encodeStateVector(currentDoc);
    return Y.encodeStateAsUpdate(targetDoc, currentStateVector);
  }

  extractText(state: Uint8Array): string {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);
    const xml = doc.getXmlFragment('prosemirror');
    const xmlString = xml.toString();
    // Strip XML tags for plain text indexing
    return xmlString.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}
