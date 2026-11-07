import type { Mech } from '@mechane/protocol';
import {
  Allowance,
  ListedEvent,
  MechSummary,
  Memory,
  SlackBinding,
  SlackDelivery,
  Thread,
  Trace,
  Turn,
  TurnStatus,
} from '@mechane/protocol';
import { MechId, WorkspaceId } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { ConsoleApi, Input, Output } from './api.ts';
import { deleteRows, upsertRows } from './collections.ts';
import type { CanonicalTables, CanonicalWriter } from './collections.ts';
import { MechDefinition, recordKey, TraceEvidence } from './records.ts';
import type { MechDefinitionRow, MechSummaryRow, TurnRow } from './records.ts';
import type { ReadKind, ReadReceipt, ReadRequest } from './requests.ts';

type ReadOutputs = {
  readonly mechs: Output<'listMechs'>;
  readonly mech: Output<'showMech'>;
  readonly threads: Output<'listThreads'>;
  readonly memories: Output<'listMemories'>;
  readonly turns: Output<'listTurns'>;
  readonly trace: Output<'showTurn'>;
  readonly turnEvents: Output<'listTurnEvents'>;
  readonly events: Output<'listRecentEvents'>;
  readonly slackBindings: Output<'listSlackBindings'>;
  readonly slackDeliveries: Output<'listSlackDeliveries'>;
  readonly allowance: Output<'showAllowance'>;
};

type ReadAnswer = {
  readonly [Kind in ReadKind]: {
    readonly kind: Kind;
    readonly request: ReadRequest<Kind>;
    readonly output: ReadOutputs[Kind];
  };
}[ReadKind];

type FetchRead = {
  readonly api: ConsoleApi;
  readonly workspaceId: Input<'listMechs'>['workspaceId'];
  readonly request: ReadRequest;
  readonly signal: AbortSignal;
};

/** Performs one declared API read without draining cursors or inferring filter coverage. */
export async function fetchRead({ api, workspaceId, request, signal }: FetchRead): Promise<ReadAnswer> {
  switch (request.kind) {
    case 'mechs':
      return {
        kind: request.kind,
        request,
        output: await api('listMechs', { workspaceId, after: Option.fromNullishOr(request.after) }, signal),
      };
    case 'mech':
      return {
        kind: request.kind,
        request,
        output: await api('showMech', { workspaceId, mechId: request.mechId }, signal),
      };
    case 'threads':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listThreads',
          { workspaceId, mechId: request.mechId, after: Option.fromNullishOr(request.after) },
          signal,
        ),
      };
    case 'memories':
      return {
        kind: request.kind,
        request,
        output: await api('listMemories', { workspaceId, mechId: request.mechId }, signal),
      };
    case 'turns':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listTurns',
          { workspaceId, mechId: request.mechId, after: Option.fromNullishOr(request.after) },
          signal,
        ),
      };
    case 'trace':
      return {
        kind: request.kind,
        request,
        output: await api('showTurn', { workspaceId, mechId: request.mechId, turnId: request.turnId }, signal),
      };
    case 'turnEvents':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listTurnEvents',
          { workspaceId, mechId: request.mechId, turnId: request.turnId, after: request.after },
          signal,
        ),
      };
    case 'events':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listRecentEvents',
          { workspaceId, mechId: request.mechId, before: Option.fromNullishOr(request.before) },
          signal,
        ),
      };
    case 'slackBindings':
      return {
        kind: request.kind,
        request,
        output: await api('listSlackBindings', { workspaceId: WorkspaceId.make(workspaceId) }, signal),
      };
    case 'slackDeliveries':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listSlackDeliveries',
          { workspaceId: WorkspaceId.make(workspaceId), mechId: MechId.make(request.mechId) },
          signal,
        ),
      };
    case 'allowance':
      return { kind: request.kind, request, output: await api('showAllowance', { workspaceId }, signal) };
  }
}

function writeMechSummaries(
  tables: CanonicalTables,
  rows: ReadonlyArray<MechSummaryRow>,
  isAllowed: (mechId: string) => boolean,
): void {
  for (const row of rows) {
    const previous = tables.mechs.get(row.key);

    if (isAllowed(row.key) && (previous === undefined || previous.value.revision <= row.value.revision)) {
      upsertRows(tables.mechs, [row]);
    }
  }
}

type SaveMech = {
  readonly writeRows: CanonicalWriter;
  readonly tables: CanonicalTables;
  readonly mech: Mech;
  readonly signal: AbortSignal;
};

/** Reconciles an acknowledged definition without regressing saved or active revisions. */
export async function saveMech({ writeRows, tables, mech, signal }: SaveMech): Promise<void> {
  const summary: MechSummaryRow = { key: mech.id, value: Schema.encodeSync(MechSummary)(mech) };
  const definition: MechDefinitionRow = { key: mech.id, value: Schema.encodeSync(MechDefinition)(mech) };

  await writeRows({
    collections: [tables.mechs, tables.mechDefinitions],
    signal,
    write: () => {
      const previous = tables.mechs.get(mech.id);

      if (previous !== undefined && previous.value.revision > mech.revision) {
        return;
      }

      const currentDefinition = tables.mechDefinitions.get(mech.id);
      const activeRevision = Math.max(currentDefinition?.value.active_revision ?? 0, definition.value.active_revision);

      writeMechSummaries(tables, [summary], () => true);
      upsertRows(tables.mechDefinitions, [
        { ...definition, value: { ...definition.value, active_revision: activeRevision } },
      ]);
    },
  });
}

function writeTurns(tables: CanonicalTables, rows: ReadonlyArray<TurnRow>): void {
  for (const row of rows) {
    const previous = tables.turns.get(row.key);

    const isOlderRunning =
      previous !== undefined && previous.value.status !== TurnStatus.Running && row.value.status === TurnStatus.Running;

    if (!isOlderRunning) {
      const incoming = Schema.decodeUnknownResult(Schema.toEncoded(Turn))(row.value);
      const known = Schema.decodeUnknownResult(Schema.toEncoded(Turn))(previous?.value);

      if (Result.isSuccess(incoming) && Result.isSuccess(known)) {
        const inboxItemIds = new Set([...known.success.inbox_item_ids, ...incoming.success.inbox_item_ids]);

        upsertRows(tables.turns, [{ ...row, value: { ...incoming.success, inbox_item_ids: [...inboxItemIds] } }]);
      } else {
        upsertRows(tables.turns, [row]);
      }
    }
  }
}

type ApplyRead = {
  readonly writeRows: CanonicalWriter;
  readonly tables: CanonicalTables;
  readonly answer: ReadAnswer;
  readonly signal: AbortSignal;
  readonly isMechAllowed: (mechId: string) => boolean;
  readonly isTurnAllowed: (key: string) => boolean;
};

/** Ingests canonical rows before publishing the response's exact ordered membership receipt. */
export async function applyRead({
  writeRows,
  tables,
  answer,
  signal,
  isMechAllowed,
  isTurnAllowed,
}: ApplyRead): Promise<ReadReceipt> {
  const { request } = answer;
  const receipt = { id: request.id, kind: request.kind };

  switch (answer.kind) {
    case 'mechs': {
      const rows = answer.output.mechs.map((mech) => ({ key: mech.id, value: Schema.encodeSync(MechSummary)(mech) }));

      await writeRows({
        signal,
        collections: [tables.mechs],
        write: () => writeMechSummaries(tables, rows, isMechAllowed),
      });

      return {
        ...receipt,
        keys: rows.filter((row) => isMechAllowed(row.key)).map((row) => row.key),
        hasMore: answer.output.hasMore,
      };
    }
    case 'mech':
      await saveMech({ writeRows, tables, mech: answer.output, signal });

      return { ...receipt, keys: [answer.output.id], hasMore: null };
    case 'threads': {
      const mechId = answer.request.mechId;

      const rows = answer.output.threads.map((thread) => ({
        mechId,
        key: recordKey(mechId, thread.id),
        value: Schema.encodeSync(Thread)(thread),
      }));

      await writeRows({
        signal,
        collections: [tables.threads],
        write: () => {
          for (const row of rows) {
            const previous = tables.threads.get(row.key);

            if (previous === undefined || previous.value.updated_at <= row.value.updated_at) {
              upsertRows(tables.threads, [row]);
            }
          }
        },
      });

      return { ...receipt, keys: rows.map((row) => row.key), hasMore: answer.output.hasMore };
    }
    case 'memories': {
      const mechId = answer.request.mechId;

      const rows = answer.output.memories.map((memory) => ({
        mechId,
        key: recordKey(mechId, memory.path),
        value: Schema.encodeSync(Memory)(memory),
      }));

      const keys = new Set<string>(rows.map((row) => row.key));

      await writeRows({
        signal,
        collections: [tables.memories],
        write: () => {
          for (const previous of tables.memories.values()) {
            if (previous.mechId === mechId && !keys.has(previous.key)) {
              deleteRows(tables.memories, [previous.key]);
            }
          }

          for (const row of rows) {
            const previous = tables.memories.get(row.key);

            if (previous === undefined || previous.value.version <= row.value.version) {
              upsertRows(tables.memories, [row]);
            }
          }
        },
      });

      return { ...receipt, keys: rows.map((row) => row.key), hasMore: null };
    }
    case 'turns': {
      const mechId = answer.request.mechId;

      const rows = answer.output.turns.map((turn) => ({
        mechId,
        key: recordKey(mechId, turn.id),
        value: Schema.encodeSync(Trace.to.fields.turn)(turn),
      }));

      await writeRows({
        signal,
        collections: [tables.turns],
        write: () =>
          writeTurns(
            tables,
            rows.filter((row) => isTurnAllowed(row.key)),
          ),
      });

      return {
        ...receipt,
        keys: rows.filter((row) => isTurnAllowed(row.key)).map((row) => row.key),
        hasMore: answer.output.hasMore,
      };
    }
    case 'trace': {
      const mechId = answer.request.mechId;
      const key = recordKey(mechId, answer.output.turn.id);
      const turn = { mechId, key, value: Schema.encodeSync(Trace.to.fields.turn)(answer.output.turn) };
      const evidence = { mechId, key, value: Schema.encodeSync(TraceEvidence)(answer.output) };

      await writeRows({
        signal,
        collections: [tables.turns, tables.traceEvidence],
        write: () => {
          const previous = tables.turns.get(key);

          const isOlderRunning =
            previous !== undefined &&
            previous.value.status !== TurnStatus.Running &&
            turn.value.status === TurnStatus.Running;

          writeTurns(tables, [turn]);

          if (!isOlderRunning || !tables.traceEvidence.has(key)) {
            upsertRows(tables.traceEvidence, [evidence]);
          }
        },
      });

      return { ...receipt, keys: [key], hasMore: null };
    }
    case 'events':
    case 'turnEvents': {
      const mechId = answer.request.mechId;

      const rows = answer.output.events.map((event) => ({
        mechId,
        key: recordKey(mechId, event.sequence),
        value: Schema.encodeSync(ListedEvent)(event),
      }));

      await writeRows({ signal, collections: [tables.events], write: () => upsertRows(tables.events, rows) });

      return { ...receipt, keys: rows.map((row) => row.key), hasMore: answer.output.hasMore };
    }
    case 'slackBindings': {
      const rows = answer.output.bindings.map((binding) => ({
        mechId: binding.mechId,
        key: binding.id,
        value: Schema.encodeSync(SlackBinding)(binding),
      }));

      const keys = new Set<string>(rows.map((row) => row.key));

      await writeRows({
        signal,
        collections: [tables.slackBindings],
        write: () => {
          for (const previous of tables.slackBindings.values()) {
            if (!keys.has(previous.key)) {
              deleteRows(tables.slackBindings, [previous.key]);
            }
          }

          upsertRows(
            tables.slackBindings,
            rows.filter((row) => isMechAllowed(row.mechId)),
          );
        },
      });

      return { ...receipt, keys: rows.filter((row) => isMechAllowed(row.mechId)).map((row) => row.key), hasMore: null };
    }
    case 'slackDeliveries': {
      const mechId = answer.request.mechId;

      const rows = answer.output.deliveries.map((delivery) => ({
        mechId,
        key: recordKey(mechId, delivery.id),
        value: Schema.encodeSync(SlackDelivery)(delivery),
      }));

      await writeRows({
        signal,
        collections: [tables.slackDeliveries],
        write: () => upsertRows(tables.slackDeliveries, rows),
      });

      return { ...receipt, keys: rows.map((row) => row.key), hasMore: null };
    }
    case 'allowance': {
      const row = { key: 'allowance', value: Schema.encodeSync(Allowance)(answer.output) };

      await writeRows({ signal, collections: [tables.allowance], write: () => upsertRows(tables.allowance, [row]) });

      return { ...receipt, keys: [row.key], hasMore: null };
    }
  }
}
