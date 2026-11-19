import { MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { redactToolResult } from '../../tools/redact.ts';
import { ManagedWireObject } from '../protocol.ts';
import { MCP_RESPONSE_BUFFER_BYTES, MCP_RESULT_TRUNCATED } from './settings.ts';
import type { ManagedMcpResult } from './types.ts';

const Text = Schema.Struct({ type: Schema.Literal('text'), text: Schema.String });

const Image = Schema.Struct({
  type: Schema.Literal('image'),
  mimeType: Schema.Literals([MediaType.Jpeg, MediaType.Png, MediaType.Gif, MediaType.Webp]),
  data: Schema.String,
});

const Structured = Schema.Struct({
  content: Schema.optional(Schema.Array(ManagedWireObject)),
  structuredContent: Schema.optional(ManagedWireObject),
  isError: Schema.optional(Schema.Boolean),
});

const Resource = Schema.Struct({ type: Schema.Literal('resource'), resource: Schema.Struct({ text: Schema.String }) });

const Unsupported: Readonly<ManagedWireObject> = {
  type: 'text',
  text: 'This result contains an MCP content type unavailable in this model.',
};

function toContent(block: ManagedWireObject): ManagedWireObject {
  if (Schema.is(Text)(block)) {
    return { type: 'text', text: block.text };
  }

  if (Schema.is(Image)(block)) {
    return { type: 'image', source: { type: 'base64', media_type: block.mimeType, data: block.data } };
  }

  if (Schema.is(Resource)(block)) {
    return { type: 'text', text: block.resource.text };
  }

  return Unsupported;
}

const HALF_DIVISOR = 2;
const encoder: Readonly<TextEncoder> = new TextEncoder();

function contentSize(content: ReadonlyArray<ManagedWireObject>): number {
  return encoder.encode(JSON.stringify(content)).byteLength;
}

function boundedContent(content: ReadonlyArray<ManagedWireObject>, maxBytes: number): ReadonlyArray<ManagedWireObject> {
  if (contentSize(content) <= maxBytes) {
    return content;
  }

  const limited = [{ type: 'text', text: MCP_RESULT_TRUNCATED }];

  const texts = content.map((block) => block['text']).filter((text) => typeof text === 'string');
  const characters = texts.join('\n');
  let low = 0;
  let high = Math.min(maxBytes, characters.length);

  while (low < high) {
    const middle = Math.ceil((low + high) / HALF_DIVISOR);
    const text = `${characters.slice(0, middle)}\n${MCP_RESULT_TRUNCATED}`;

    if (contentSize([{ type: 'text', text }]) <= maxBytes) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  if (low > 0) {
    limited[0] = {
      type: 'text',
      text: `${characters.slice(0, low).replace(/[\uD800-\uDBFF]$/u, '')}\n${MCP_RESULT_TRUNCATED}`,
    };
  }

  return limited;
}

export function managedMcpResult(raw: unknown, secrets: ReadonlyArray<string>, maxBytes: number): ManagedMcpResult {
  const cleaned = redactToolResult({ value: raw, secrets, maximumBytes: MCP_RESPONSE_BUFFER_BYTES });

  if (cleaned === undefined) {
    return {
      content: [{ type: 'text', text: MCP_RESULT_TRUNCATED }],
      is_error: Schema.is(Schema.Struct({ isError: Schema.Literal(true) }))(raw),
    };
  }

  const body = Schema.decodeUnknownSync(Structured)(cleaned);
  const content = (body.content ?? []).map(toContent);

  if (content.length === 0 && body.structuredContent !== undefined) {
    content.push({ type: 'text', text: JSON.stringify(body.structuredContent) });
  }

  return { content: boundedContent(content, maxBytes), is_error: body.isError ?? false };
}

export function managedMcpFailure(text: string): ManagedMcpResult {
  return { content: [{ type: 'text', text }], is_error: true };
}
