import type { ImageContent, TextContent } from '@earendil-works/pi-ai';
import { MediaType } from '@mechane/records';
import { Schema } from 'effect';
import type { ModelOffer } from '../config.ts';
import { pdfBytes } from './pdf-attachment.ts';
import { ManagedWireObject } from './protocol.ts';

type Content = TextContent | ImageContent;
type Protocol = NonNullable<ModelOffer['protocol']>;
const object = Schema.is(ManagedWireObject);

function nativeDocument(encodedDocument: string) {
  return { type: 'document', source: { type: 'base64', media_type: MediaType.Pdf, data: encodedDocument } };
}

function nativeToolPart(part: Content) {
  const document = pdfBytes(part);

  if (document !== undefined) {
    return nativeDocument(document);
  }

  if (part.type === 'image') {
    return { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } };
  }

  return { type: 'text', text: part.text.toWellFormed() };
}

function filePart(encodedDocument: string, protocol: Protocol, original: ManagedWireObject) {
  if (protocol === 'anthropic-messages') {
    const content = nativeDocument(encodedDocument);

    if (original['cache_control'] !== undefined) {
      return { ...content, cache_control: original['cache_control'] };
    }

    return content;
  }

  return {
    type: 'file',
    file: { filename: 'document.pdf', file_data: `data:${MediaType.Pdf};base64,${encodedDocument}` },
  };
}

type PreparedFiles = {
  readonly protocol: Protocol;
  readonly files: ReadonlyMap<string, string>;
  readonly toolResults: ReadonlyMap<string, ReadonlyArray<Content>>;
};

export function insertFiles(payload: unknown, prepared: PreparedFiles): unknown {
  if (!object(payload) || !Array.isArray(payload['messages'])) {
    throw new Error('The model adapter could not attach the session documents');
  }

  const remaining = new Map(prepared.files);
  const tools = new Map(prepared.toolResults);

  const messages = payload['messages'].map((message: unknown) => {
    if (!object(message) || message['role'] !== 'user' || !Array.isArray(message['content'])) {
      return message;
    }

    const content = message['content'].map((part: unknown) => {
      if (!object(part)) {
        return part;
      }

      if (part['type'] === 'tool_result' && typeof part['content'] === 'string') {
        const result = tools.get(part['content']);

        if (result !== undefined) {
          tools.delete(part['content']);

          return { ...part, content: result.map(nativeToolPart) };
        }
      }

      if (part['type'] !== 'text' || typeof part['text'] !== 'string') {
        return part;
      }

      const encodedDocument = remaining.get(part['text']);

      if (encodedDocument === undefined) {
        return part;
      }

      remaining.delete(part['text']);

      return filePart(encodedDocument, prepared.protocol, part);
    });

    return { ...message, content };
  });

  if (remaining.size > 0 || tools.size > 0) {
    throw new Error('The model adapter omitted a session document');
  }

  return { ...payload, messages };
}
