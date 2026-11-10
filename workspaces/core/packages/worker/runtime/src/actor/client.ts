import type { ImportedSpendReservation as SpendReservation } from '@mechane/control-store';
import { MechHistoryImportReceipt, MechMaintenanceReceipt, ServerFailure } from '@mechane/protocol';
import type { MechHistoryImportBatch } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MechId, MediaType, WorkspaceId } from '@mechane/records';
import { SandboxCompletion } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { ActivityEvent, ConsoleMessage, Notification, NotificationReceipt, Run } from '../domain.ts';
import {
  ActivityRecord,
  CancellationRecord,
  ExportRecord,
  MessageRecord,
  NotificationReceiptRecord,
  RunRecord,
  StatusRecord,
  TraceRecord,
  WakeRecord,
} from './records.ts';

export type MechScope = { readonly workspaceId: string; readonly mechId: string };

export type ActorNotification = Omit<Notification, 'workspaceId' | 'mechId' | 'receivedSequence' | 'receivedAt'> & {
  readonly shouldPublishToConsole?: boolean;
};

export type ActorPageInput = { readonly after?: string | null | undefined; readonly maxRows?: number | undefined };
export type ActorPage<T> = { readonly items: ReadonlyArray<T>; readonly hasMore: boolean };

export type ActorWake = {
  readonly id: string;
  readonly mechId: string;
  readonly status: 'scheduled' | 'cancelled' | 'delivered';
  readonly text: string;
  readonly createdAt: string;
  readonly dueAt: string;
  readonly canceledAt: string | null;
  readonly deliveredAt: string | null;
  readonly notificationId: string | null;
};

export type ScheduleWakeInput = {
  readonly wakeId: string;
  readonly text: string;
  readonly afterSeconds?: number;
  readonly at?: string;
};

export type PublishMessageInput = {
  readonly messageId: string;
  readonly text: string;
  readonly presentation?: Readonly<Record<string, unknown>> | undefined;
};

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

export type ActorExport = {
  readonly version: 1;
  readonly source: MechScope;
  readonly exportedAt: string;
  readonly sourceSequence: number;
  readonly definitionRevision: number;
  readonly context: string;
};

export type ActorHistoryImport = MechHistoryImportBatch;
export type MechActorResolver = (scope: MechScope) => MechActorClient;
export type ActorHistoryImportReceipt = typeof MechHistoryImportReceipt.Type;

export type MechActorClient = {
  readonly admitNotification: (input: ActorNotification) => Promise<NotificationReceipt>;
  readonly applyControlChange: (input: ActorControlChange) => Promise<void>;
  readonly acceptCompletion: (input: SandboxCompletion) => Promise<void>;
  readonly status: () => Promise<ActorStatus>;
  readonly readMech: () => Promise<ActorStatus>;
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
  readonly cancelRun: (input: { readonly turnId: string; readonly cancelerId: string }) => Promise<Run>;
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
  readonly scheduleWake: (input: ScheduleWakeInput) => Promise<ActorWake>;
  readonly readWake: (input: { readonly wakeId: string }) => Promise<ActorWake | null>;
  readonly listWakes: (input: ActorPageInput) => Promise<ActorPage<ActorWake>>;
  readonly cancelWake: (input: { readonly wakeId: string }) => Promise<ActorWake>;
  readonly publishMessage: (input: PublishMessageInput) => Promise<ConsoleMessage>;
  readonly quiesce: () => Promise<void>;
  readonly resume: () => Promise<void>;
  readonly exportContext: (input?: { readonly requestId?: string | undefined }) => Promise<ActorExport>;
  readonly importContext: (input: { readonly requestId: string; readonly exported: ActorExport }) => Promise<void>;
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
    admitNotification: (value) => call('admitNotification', value, NotificationReceiptRecord),
    applyControlChange: (value) => write('applyControlChange', value),
    acceptCompletion: (value) => write('acceptCompletion', Schema.encodeSync(SandboxCompletion)(value)),
    status: () => call('status', {}, StatusRecord),
    readMech: () => call('status', {}, StatusRecord),
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
    cancelRun: (value) => call('cancelRun', value, RunRecord),
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
    scheduleWake: (value) => call('scheduleWake', value, WakeRecord),
    readWake: (value) => call('readWake', value, Schema.NullOr(WakeRecord)),
    listWakes: (value) =>
      call('listWakes', value, Schema.Struct({ items: Schema.Array(WakeRecord), hasMore: Schema.Boolean })),
    cancelWake: (value) => call('cancelWake', value, WakeRecord),
    publishMessage: (value) => call('publishMessage', value, MessageRecord),
    quiesce: () => write('quiesce'),
    resume: () => write('resume'),
    exportContext: (value) => call('exportContext', value ?? {}, ExportRecord),
    importContext: (value) => write('importContext', value),
    importHistory: (value) => call('importHistory', value, MechHistoryImportReceipt),
  };
}
