import type { ImportedMechContext, MechScope } from '@mechane/control-store';
import { MECH_HISTORY_IMPORT_BATCH_MAX_BYTES, MechHistoryImport, MechHistorySourceKind } from '@mechane/protocol';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HistoryImportFailed } from './errors.ts';

const EMPTY_REQUEST_ID = '00000000-0000-5000-a000-000000000000';
const EMPTY_SOURCE_DIGEST = '0'.repeat(64);
const IMPORT_PROVENANCE_MAX_BYTES = 1024;
const PAYLOAD_MAX_BYTES = MECH_HISTORY_IMPORT_BATCH_MAX_BYTES - IMPORT_PROVENANCE_MAX_BYTES;
const JsonRecord = Schema.Record(Schema.String, Schema.Unknown);

export type ImportBatchFile = { readonly path: string; readonly bytes: number; readonly digest: string };

type BatchPayload = {
  readonly context: unknown;
  readonly workingContext: null;
  readonly history: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly notifications: ReadonlyArray<unknown>;
  readonly executions: ReadonlyArray<unknown>;
};

type CreateBatchWriterInput = MechScope & { readonly directory: string; readonly context: ImportedMechContext | null };
type ContextPayloadInput = { readonly context: ImportedMechContext | null };

type AppendRecordInput = {
  readonly kind: string;
  readonly record: unknown;
  readonly notification?: unknown;
  readonly execution?: unknown;
};

type AddedPayloadInput = AppendRecordInput & { readonly payload: BatchPayload };
type SerializeInput = { readonly payload: BatchPayload; readonly isFinal: boolean };
type FlushInput = { readonly isFinal: boolean };

function emptyPayload(): BatchPayload {
  return { context: null, workingContext: null, history: [], notifications: [], executions: [] };
}

function contextPayload({ context }: ContextPayloadInput): BatchPayload {
  if (context === null) {
    return emptyPayload();
  }

  return {
    context: {
      receivedSequence: context.receivedSequence,
      presentedSequence: context.presentedSequence,
      isEnvironmentCheckpointRequired: context.isEnvironmentCheckpointRequired,
      notesImportedAt: context.notesImportedAt,
      isContextInitialized: context.isContextInitialized,
      modelMessages: context.modelMessages,
    },
    workingContext: null,
    history: [{ kind: MechHistorySourceKind.Context, record: Schema.decodeUnknownSync(JsonRecord)(context) }],
    notifications: [],
    executions: [],
  };
}

function addedPayload({ payload, kind, record, notification, execution }: AddedPayloadInput): BatchPayload {
  const notifications = [...payload.notifications];
  const executions = [...payload.executions];

  if (notification !== undefined) {
    notifications.push(notification);
  }

  if (execution !== undefined) {
    executions.push(execution);
  }

  return {
    ...payload,
    history: [...payload.history, { kind, record: Schema.decodeUnknownSync(JsonRecord)(record) }],
    notifications,
    executions,
  };
}

export function createBatchWriter({ workspaceId, mechId, directory, context }: CreateBatchWriterInput) {
  const state = { payload: contextPayload({ context }), bytes: 0, files: new Array<ImportBatchFile>() };
  const sourceHash = createHash('sha256');

  function serialize({ payload, isFinal }: SerializeInput): string {
    const value = {
      workspaceId,
      mechId,
      requestId: EMPTY_REQUEST_ID,
      sourceDigest: EMPTY_SOURCE_DIGEST,
      expectedSequence: state.files.length,
      sourceSequence: state.files.length + 1,
      ...payload,
      isFinal,
    };

    const decoded = Schema.decodeUnknownResult(MechHistoryImport, { onExcessProperty: 'error' })(value);

    if (decoded._tag === 'Failure') {
      throw new HistoryImportFailed({ reason: `Preserved history contains invalid import records for mech ${mechId}` });
    }

    return JSON.stringify(Schema.encodeSync(MechHistoryImport)(decoded.success));
  }

  async function flush({ isFinal }: FlushInput): Promise<void> {
    const text = serialize({ payload: state.payload, isFinal });
    const bytes = new TextEncoder().encode(text).byteLength;

    if (bytes > PAYLOAD_MAX_BYTES) {
      throw new HistoryImportFailed({
        reason: `One preserved record exceeds the import batch bound for mech ${mechId}`,
      });
    }

    const path = join(directory, `${workspaceId}-${mechId}-${state.files.length + 1}.json`);

    await writeFile(path, text, { mode: 0o600, flag: 'wx' });
    sourceHash.update(text);
    state.files.push({ path, bytes, digest: createHash('sha256').update(text).digest('hex') });

    state.bytes += bytes;
    state.payload = emptyPayload();
  }

  return {
    append: async (input: AppendRecordInput): Promise<void> => {
      const candidate = addedPayload({ payload: state.payload, ...input });

      const serialized = serialize({ payload: candidate, isFinal: false });

      if (new TextEncoder().encode(serialized).byteLength > PAYLOAD_MAX_BYTES) {
        await flush({ isFinal: false });

        state.payload = addedPayload({ payload: emptyPayload(), ...input });
      } else {
        state.payload = candidate;
      }
    },
    finish: async () => {
      await flush({ isFinal: true });

      return { files: state.files, sourceBytes: state.bytes, sourceDigest: sourceHash.digest('hex') };
    },
  };
}
