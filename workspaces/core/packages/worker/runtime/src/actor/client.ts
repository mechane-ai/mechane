import type { ImportedSpendReservation as SpendReservation } from '@mechane/control-store';
import {
  HeldWorkPage,
  MechHistoryImportReceipt,
  MechMaintenanceReceipt,
  ServerFailure,
  SourceCompletion,
} from '@mechane/protocol';
import type { MechHistoryImportBatch } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MechId, MediaType, WorkspaceId } from '@mechane/records';
import { SandboxCompletion } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { ActivityEvent, ConsoleMessage, Run } from '../domain.ts';
import {
  ActivityRecord,
  CancellationRecord,
  MessageRecord,
  RoutineRecord,
  RunRecord,
  StatusRecord,
  TraceRecord,
} from './records.ts';

export type MechScope = { readonly workspaceId: string; readonly mechId: string };

export type ActorPageInput = { readonly after?: string | null | undefined; readonly maxRows?: number | undefined };
export type ActorPage<T> = { readonly items: ReadonlyArray<T>; readonly hasMore: boolean };

export type ActorRoutine = typeof RoutineRecord.Type;

export type ActorControlChange = {
  readonly id: string;
  readonly sourceSequence: number;
  readonly kind: string;
  readonly revision?: number;
  readonly payloadDigest?: string;
};

export type ActorStatus = MechScope & {
  readonly activeRevision: number;
  readonly turnId: string | null;
  readonly status: 'idle' | 'running' | 'paused' | 'quiesced';
  readonly admittedSequence: number;
  readonly observedSequence: number;
};

export type ActorHistoryEntry = {
  readonly id: string;
  readonly kind: string;
  readonly text: string;
  readonly turnId: string | null;
  readonly createdAt: string | null;
};

export type ActorMaintenance = ActorStatus & {
  readonly pendingNativeTaskCount: number;
  readonly pendingEffectCount: number;
  readonly isCheckpointRequired: boolean;
  readonly isImportComplete: boolean;
  readonly canResume: boolean;
};

export type ActorTrace = {
  readonly run: Run;
  readonly events: ReadonlyArray<ActivityEvent>;
  readonly dispatches: ReadonlyArray<SpendReservation>;
  readonly toolCalls: ReadonlyArray<unknown>;
  readonly evidenceNotices: ReadonlyArray<string>;
};

export type ActorHistoryImport = MechHistoryImportBatch;
export type MechActorResolver = (scope: MechScope) => MechActorClient;
export type ActorHistoryImportReceipt = typeof MechHistoryImportReceipt.Type;

export type MechActorClient = {
  readonly applyControlChange: (input: ActorControlChange) => Promise<void>;
  readonly listArchivedCompletions: (
    input: ActorPageInput,
  ) => Promise<ActorPage<SourceCompletion> & { readonly nextCursor: string | null }>;
  readonly acceptCompletion: (input: SandboxCompletion) => Promise<void>;
  readonly status: () => Promise<ActorStatus>;
  readonly readMech: () => Promise<ActorStatus>;
  readonly listHeldWork: (input: ActorPageInput) => Promise<typeof HeldWorkPage.Encoded>;
  readonly listHistory: (
    input: ActorPageInput,
  ) => Promise<{
    readonly entries: ReadonlyArray<ActorHistoryEntry>;
    readonly hasMore: boolean;
    readonly nextCursor: string | null;
  }>;
  readonly maintenance: (input: { readonly action: 'quiesce' | 'resume' }) => Promise<ActorMaintenance>;
  readonly listRuns: (input: ActorPageInput) => Promise<ActorPage<Run>>;
  readonly readRun: (input: { readonly turnId: string }) => Promise<Run | null>;
  readonly readTrace: (input: { readonly turnId: string }) => Promise<ActorTrace>;
  readonly readCancellation: (input: {
    readonly turnId: string;
  }) => Promise<{ readonly cancelerId: string; readonly canceledAt: string } | null>;
  readonly listEvents: (input: {
    readonly afterSequence?: number;
    readonly beforeSequence?: number;
    readonly isNewestFirst?: boolean;
    readonly runId?: string;
    readonly maxRows?: number;
  }) => Promise<{
    readonly events: ReadonlyArray<ActivityEvent>;
    readonly hasMore: boolean;
    readonly afterSequence: number;
  }>;
  readonly listConsoleMessages: (input: {
    readonly beforeSequence?: number;
    readonly afterSequence?: number;
    readonly maxRows?: number;
  }) => Promise<{
    readonly messages: ReadonlyArray<ConsoleMessage>;
    readonly hasMore: boolean;
    readonly beforeSequence: number | null;
  }>;
  readonly readRoutine: (input: { readonly routineId: string }) => Promise<ActorRoutine | null>;
  readonly listRoutines: (input: ActorPageInput) => Promise<ActorPage<ActorRoutine>>;
  readonly importHistory: (input: ActorHistoryImport) => Promise<ActorHistoryImportReceipt>;
};

export type ActorNamespace = {
  readonly getByName: (name: string) => { readonly fetch: (request: Request) => Promise<Response> };
};

type CreateClientInput = MechScope & { readonly namespace: ActorNamespace };

const ActorScope = Schema.Struct({ workspaceId: WorkspaceId, mechId: MechId });

export function createMechActorClient(input: CreateClientInput): MechActorClient {
  const scope = Schema.decodeUnknownSync(ActorScope)(input);
  const stub = input.namespace.getByName(scope.mechId);

  async function call<T>(method: string, value: unknown, schema: Schema.Codec<T, unknown>): Promise<T> {
    const response = await stub.fetch(
      new Request('https://mech.internal/operation', {
        method: HttpMethod.Post,
        headers: { [HttpHeader.ContentType]: MediaType.Json },
        body: JSON.stringify({ workspaceId: scope.workspaceId, mechId: scope.mechId, method, input: value }),
      }),
    );

    const result: unknown = JSON.parse(await response.text());

    if (!response.ok) {
      if (result !== null && typeof result === 'object' && 'failure' in result) {
        throw Schema.decodeUnknownSync(ServerFailure)(result.failure);
      }

      throw new Error('The mech actor operation failed');
    }

    return Schema.decodeUnknownSync(schema)(result);
  }

  async function write(method: string, value: unknown = {}): Promise<void> {
    await call(method, value, Schema.Null);
  }

  return {
    applyControlChange: (value) => write('applyControlChange', value),
    listArchivedCompletions: (value) =>
      call(
        'listArchivedCompletions',
        value,
        Schema.Struct({
          items: Schema.Array(SourceCompletion),
          hasMore: Schema.Boolean,
          nextCursor: Schema.NullOr(Schema.String),
        }),
      ),
    acceptCompletion: (value) => write('acceptCompletion', Schema.encodeSync(SandboxCompletion)(value)),
    status: () => call('status', {}, StatusRecord),
    readMech: () => call('status', {}, StatusRecord),
    listHeldWork: (value) => call('listHeldWork', value, Schema.toEncoded(HeldWorkPage)),
    listHistory: (value) =>
      call(
        'listHistory',
        value,
        Schema.Struct({
          entries: Schema.Array(
            Schema.Struct({
              id: Schema.String,
              kind: Schema.String,
              text: Schema.String,
              turnId: Schema.NullOr(Schema.String),
              createdAt: Schema.NullOr(Schema.String),
            }),
          ),
          hasMore: Schema.Boolean,
          nextCursor: Schema.NullOr(Schema.String),
        }),
      ),
    maintenance: (value) => call('maintenance', value, Schema.toEncoded(MechMaintenanceReceipt)),
    listRuns: (value) =>
      call('listRuns', value, Schema.Struct({ items: Schema.Array(RunRecord), hasMore: Schema.Boolean })),
    readRun: (value) => call('readRun', value, Schema.NullOr(RunRecord)),
    readTrace: (value) => call('readTrace', value, TraceRecord),
    readCancellation: (value) => call('readCancellation', value, Schema.NullOr(CancellationRecord)),
    listEvents: (value) =>
      call(
        'listEvents',
        value,
        Schema.Struct({ events: Schema.Array(ActivityRecord), hasMore: Schema.Boolean, afterSequence: Schema.Number }),
      ),
    listConsoleMessages: (value) =>
      call(
        'listConsoleMessages',
        value,
        Schema.Struct({
          messages: Schema.Array(MessageRecord),
          hasMore: Schema.Boolean,
          beforeSequence: Schema.NullOr(Schema.Number),
        }),
      ),
    readRoutine: (value) => call('readRoutine', value, Schema.NullOr(RoutineRecord)),
    listRoutines: (value) =>
      call('listRoutines', value, Schema.Struct({ items: Schema.Array(RoutineRecord), hasMore: Schema.Boolean })),
    importHistory: (value) => call('importHistory', value, MechHistoryImportReceipt),
  };
}
