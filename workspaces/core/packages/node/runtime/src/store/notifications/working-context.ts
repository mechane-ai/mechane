import type { ModelMessage } from 'ai';
import { StoreConflict } from '../errors.ts';

type BoundContext = {
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly maximumBytes: number;
  readonly wasLimited?: boolean;
  readonly notice?: string;
};

const OMISSION_NOTICE = {
  role: 'system',
  content:
    'Some stored conversation content was omitted from this bounded working context. Original messages remain in recorded activation traces; omission does not mean that earlier work was completed.',
} as const satisfies ModelMessage;

function recordToolCalls(message: ModelMessage, pending: ReadonlySet<string>): ReadonlySet<string> {
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return pending;
  }

  const calls = message.content.filter((part) => part.type === 'tool-call').map((part) => part.toolCallId);

  return new Set([...pending, ...calls]);
}

function consumeToolResults(message: ModelMessage, pending: ReadonlySet<string>): ReadonlySet<string> | null {
  if (message.role !== 'tool') {
    return pending;
  }

  const remaining = new Set(pending);

  for (const part of message.content) {
    if (part.type === 'tool-result' && !remaining.delete(part.toolCallId)) {
      return null;
    }
  }

  return remaining;
}

function hasCompleteToolCalls(messages: ReadonlyArray<ModelMessage>): boolean {
  let pending: ReadonlySet<string> = new Set();

  for (const message of messages) {
    const calls = recordToolCalls(message, pending);
    const remaining = consumeToolResults(message, calls);

    if (remaining === null) {
      return false;
    }

    pending = remaining;
  }

  return pending.size === 0;
}

export function boundWorkingContext({
  messages,
  maximumBytes,
  wasLimited = false,
  notice,
}: BoundContext): ReadonlyArray<ModelMessage> {
  const groups: Array<Array<ModelMessage>> = [];

  for (const message of messages) {
    if (message.role === 'user' || groups.length === 0) {
      groups.push([]);
    }

    groups.at(-1)?.push(message);
  }

  const retained: Array<ModelMessage> = [];
  const notices: Array<ModelMessage> = [];

  if (notice !== undefined) {
    notices.push({ role: 'system', content: notice });
  }

  let sizeBytes = Buffer.byteLength(JSON.stringify([OMISSION_NOTICE, ...notices]));
  let omitted = wasLimited;

  if (sizeBytes > maximumBytes) {
    throw new StoreConflict('Working context notices exceed the storage limit');
  }

  for (const group of groups.toReversed()) {
    const groupBytes = Buffer.byteLength(JSON.stringify(group));

    if (hasCompleteToolCalls(group)) {
      if (sizeBytes + groupBytes > maximumBytes) {
        omitted = true;
        break;
      }

      retained.unshift(...group);

      sizeBytes += groupBytes;
    } else {
      omitted = true;
    }
  }

  if (omitted) {
    retained.unshift(OMISSION_NOTICE);
  }

  retained.push(...notices);

  return retained;
}
