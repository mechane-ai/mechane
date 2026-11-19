import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { actorRecordCollection } from '../../actor/record-store.ts';
import type { ActorRecordReader } from '../../actor/record-store.ts';
import { decodeStored } from '../../actor/records.ts';
import { fingerprint } from '../../actor/state.ts';
import { ManagedEvent, ManagedWireObject } from '../protocol.ts';

const Row = Schema.Struct({ threadId: Schema.NullOr(Schema.String), event: ManagedEvent });
export type ManagedEventRow = typeof Row.Type;

export type PreparedEvent = {
  readonly event: ManagedEvent;
  readonly wireBytes: number;
  readonly load: () => Promise<ManagedEventRow>;
};

const Manifest = Schema.Struct({
  threadId: Schema.NullOr(Schema.String),
  header: ManagedEvent,
  chunks: Schema.Array(Schema.String),
  wireBytes: Schema.Int,
});

const Stored = Schema.Union([Schema.Struct({ ...Row.fields, wireBytes: Schema.Int }), Manifest]);

const Chunk = defineDocFamily({
  kind: 'managed.event-payload',
  version: 1,
  family: true,
  scope: 'session',
  initial: (_seed: null): { readonly text: string | null } => ({ text: null }),
  checkpointWhen: () => true,
});

// Pi serializes each document into a SQLite row. This leaves room for UTF-8 and JSON escaping.
const CHUNK_CODE_UNITS = 262_144;
const LAST_SINGLE_UNIT_CODE_POINT = 0xff_ff;

function* payloadChunks(text: string) {
  let start = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK_CODE_UNITS);

    if ((text.codePointAt(end - 1) ?? 0) > LAST_SINGLE_UNIT_CODE_POINT) {
      end -= 1;
    }

    yield text.slice(start, end);
    start = end;
  }
}

function header(event: ManagedEvent): ManagedEvent {
  const fields: Record<string, unknown> = {};

  if (typeof event['is_error'] === 'boolean') {
    fields['is_error'] = event['is_error'];
  }

  if (event.type === 'user.tool_confirmation') {
    fields['tool_use_id'] = event['tool_use_id'];
    fields['result'] = event['result'];
  }

  if (typeof event['evaluated_permission'] === 'string') {
    fields['evaluated_permission'] = event['evaluated_permission'];
  }

  return { id: event.id, type: event.type, processed_at: event.processed_at, ...fields };
}

function describe(stored: typeof Stored.Type) {
  if ('chunks' in stored) {
    return { threadId: stored.threadId, event: stored.header, large: true };
  }

  return { threadId: stored.threadId, event: stored.event, large: false };
}

async function hydrate(
  stored: typeof Stored.Type,
  readChunk: (key: string) => Promise<string | undefined>,
): Promise<ManagedEventRow> {
  if ('event' in stored) {
    return stored;
  }

  const values: Array<string> = [];

  for (const key of stored.chunks) {
    const chunk = await readChunk(key);

    if (chunk === undefined) {
      throw new Error('Managed event payload is missing a committed chunk.');
    }

    values.push(chunk);
  }

  const fields = decodeStored(ManagedWireObject, values.join(''));

  return { threadId: stored.threadId, event: { ...fields, ...stored.header } };
}

export function sessionEvents(sessionId: string) {
  const rows = actorRecordCollection(`managed-events:${sessionId}`, Stored);
  const committedChunks = actorRecordCollection(`managed-event-chunks:${sessionId}`, Schema.Boolean);

  function chunkAddress(key: string) {
    return JSON.stringify([sessionId, key]);
  }

  async function chunk(transaction: Tx, key: string) {
    const document = await transaction.doc(Chunk, chunkAddress(key), null);

    return document.text ?? undefined;
  }

  async function put(transaction: Tx, key: string, row: ManagedEventRow) {
    const utf8 = new TextEncoder();
    const serialized = JSON.stringify(row.event);

    if (serialized.length <= CHUNK_CODE_UNITS) {
      await rows.put(transaction, key, { ...row, wireBytes: utf8.encode(serialized).byteLength });

      return;
    }

    const parts: Array<string> = [];
    let wireBytes = 0;

    for (const part of payloadChunks(serialized)) {
      wireBytes += utf8.encode(part).byteLength;
      const digest = await fingerprint(part);

      if ((await committedChunks.read(transaction, digest)) !== true) {
        const document = await transaction.doc(Chunk, chunkAddress(digest), null);
        document.text = part;

        await committedChunks.put(transaction, digest, true);
      }

      parts.push(digest);
    }

    await rows.put(transaction, key, { threadId: row.threadId, header: header(row.event), chunks: parts, wireBytes });
  }

  async function inspect(reader: ActorRecordReader, id: string): Promise<PreparedEvent | undefined> {
    const stored = await rows.get(reader, id);

    if (stored === undefined) {
      return;
    }

    return {
      event: describe(stored).event,
      wireBytes: stored.wireBytes,
      async load() {
        return await hydrate(stored, async (key) => {
          const document = await reader.snapshot(Chunk, chunkAddress(key), BACKGROUND_CONTEXT);

          return document?.text ?? undefined;
        });
      },
    };
  }

  return {
    put,
    inspect,
    async process(transaction: Tx, id: string, stamp: () => Promise<string | null>) {
      const stored = await rows.read(transaction, id);

      if (stored === undefined) {
        return;
      }

      const { event } = describe(stored);
      const row = { threadId: stored.threadId, event };

      if (row.event.processed_at !== null) {
        return { row, changed: false };
      }

      const processedAt = await stamp();
      const processed = { threadId: row.threadId, event: { ...row.event, processed_at: processedAt } };
      const wireBytes = stored.wireBytes + JSON.stringify(processedAt).length - JSON.stringify(null).length;

      if ('chunks' in stored) {
        await rows.put(transaction, id, { ...stored, header: processed.event, wireBytes });
      } else {
        await rows.put(transaction, id, { ...processed, wireBytes });
      }

      return { row: processed, changed: true };
    },
    async describe(transaction: Tx, id: string) {
      const stored = await rows.read(transaction, id);

      if (stored === undefined) {
        return;
      }

      return describe(stored);
    },
    async get(reader: ActorRecordReader, id: string) {
      const entry = await inspect(reader, id);

      return await entry?.load();
    },
    async read(transaction: Tx, id: string) {
      const stored = await rows.read(transaction, id);

      if (stored === undefined) {
        return;
      }

      return await hydrate(stored, (key) => chunk(transaction, key));
    },
  };
}
