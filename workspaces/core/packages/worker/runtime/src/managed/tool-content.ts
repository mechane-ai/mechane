import type { ToolExecutionResult, UserInput } from '@earendil-works/pi-durable';
import { ManagedRuntimeError, pdfAttachment } from '@mechane/model-gateway';
import { HttpStatusCode, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedWireObject } from './protocol.ts';

type Content = Exclude<UserInput, string>[number];
const unexpandedImages: ReadonlySet<string> = new Set(['file', 'url']);
const decodeObject = Schema.decodeUnknownSync(ManagedWireObject);
const decodeBlocks = Schema.decodeUnknownSync(Schema.Array(ManagedWireObject));
const decodeString = Schema.decodeUnknownSync(Schema.String);

function text(value: unknown): Content {
  return { type: 'text', text: decodeString(value) };
}

function invalid(message: string): never {
  throw new ManagedRuntimeError({ status: HttpStatusCode.BadRequest, message });
}

function base64Bytes(encoded: string): string {
  try {
    const bytes = atob(encoded);

    if (bytes.length > 0) {
      return bytes;
    }
  } catch {
    return invalid('Invalid base64 content');
  }

  return invalid('Encoded content must be nonempty');
}

function utf8Document(bytes: string): Content {
  const input = Uint8Array.from(bytes, (character) => character.codePointAt(0) ?? 0);

  try {
    return text(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(input));
  } catch {
    return invalid('Text documents must contain UTF-8');
  }
}

function documentContent(block: ManagedWireObject): ReadonlyArray<Content> {
  const source = decodeObject(block['source']);

  if (source['type'] === 'url') {
    return [];
  }

  if (source['type'] === 'file') {
    return invalid('File document sources are unavailable on this installation.');
  }

  const context = [block['title'], block['context']].filter((part) => typeof part === 'string');

  if (source['type'] === 'text' && source['media_type'] === MediaType.PlainText) {
    return [...context.map(text), text(source['data'])];
  }

  if (source['type'] === 'base64') {
    const encodedDocument = decodeString(source['data']);
    const bytes = base64Bytes(encodedDocument);

    switch (source['media_type']) {
      case MediaType.PlainText:
        return [...context.map(text), utf8Document(bytes)];
      case MediaType.Pdf:
        return [...context.map(text), pdfAttachment(encodedDocument)];
      default:
        return invalid('Unsupported document media type');
    }
  }

  return invalid('Unsupported document media type.');
}

function imageContent(block: ManagedWireObject): ReadonlyArray<Content> {
  const source = decodeObject(block['source']);

  if (unexpandedImages.has(decodeString(source['type']))) {
    return [];
  }

  if (source['type'] !== 'base64') {
    return invalid('Unknown image source.');
  }

  const encodedImage = decodeString(source['data']);

  base64Bytes(encodedImage);

  const mimeType = decodeString(source['media_type']);

  if (mimeType.length === 0) {
    return invalid('Image media type must be nonempty');
  }

  return [{ type: 'image', data: encodedImage, mimeType }];
}

function searchResult(block: ManagedWireObject): ReadonlyArray<Content> {
  const snippets = decodeBlocks(block['content']);
  const headings = [text(block['title']), text(block['source'])];

  return headings.concat(
    snippets.map((snippet) => {
      if (snippet['type'] !== 'text') {
        return invalid('A search-result snippet must contain text.');
      }

      return text(snippet['text']);
    }),
  );
}

function contentBlocks(block: ManagedWireObject): ReadonlyArray<Content> {
  switch (block['type']) {
    case 'text':
      return [text(block['text'])];
    case 'image':
      return imageContent(block);
    case 'document':
      return documentContent(block);
    case 'search_result':
      return searchResult(block);
    case 'redacted':
      return [];
    default:
      return invalid('Unsupported content block.');
  }
}

export function managedInputContent(event: ManagedWireObject): UserInput {
  if (event['type'] === 'session.thread_status_terminated') {
    const threadId = decodeString(event['session_thread_id']);

    return [{ type: 'text', text: `Mechane runtime: delegated thread ${threadId} terminated.` }];
  }

  if (event['type'] === 'session.thread_status_idle') {
    const threadId = decodeString(event['session_thread_id']);
    const reason = decodeObject(event['stop_reason'])['type'];

    switch (reason) {
      case 'refusal':
      case 'retries_exhausted':
        return [{ type: 'text', text: `Mechane runtime: delegated thread ${threadId} stopped (${reason}).` }];
      default:
        return invalid('Only a failed delegated thread status can resume its coordinator.');
    }
  }

  return decodeBlocks(event['content']).flatMap(contentBlocks);
}

export function managedResultContent(event: ManagedWireObject): ToolExecutionResult {
  const output = decodeBlocks(event['content'] ?? []).flatMap(contentBlocks);

  return { output, isError: event['is_error'] === true };
}
