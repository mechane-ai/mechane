import type { Mech } from '@mechane/protocol';
import {
  Allowance,
  EvidenceArtifact,
  ListedEvent,
  MechSummary,
  ProcessObservation,
  SandboxReport,
  Trace,
  Turn,
  TurnStatus,
} from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { ConsoleApi, Input, Output } from './api.ts';
import { upsertRows } from './collections.ts';
import type { CanonicalTables, CanonicalWriter } from './collections.ts';
import { MechDefinition, recordKey, TraceEvidence, turnVersion } from './records.ts';
import type { MechDefinitionRow, MechSummaryRow, TurnRow } from './records.ts';
import type { ReadKind, ReadReceipt, ReadRequest } from './requests.ts';

const terminalTurnStatuses: ReadonlySet<string> = new Set([
  TurnStatus.Completed,
  TurnStatus.Failed,
  TurnStatus.Stopped,
]);

type ReadOutputs = {
  readonly mechs: Output<'listMechs'>;
  readonly mech: Output<'showMech'>;
  readonly turns: Output<'listTurns'>;
  readonly trace: Output<'showTurn'>;
  readonly evidence: Output<'listEvidence'>;
  readonly evidenceArtifact: Output<'showEvidence'>;
  readonly environment: Output<'showEnvironment'>;
  readonly environmentProcess: Output<'showEnvironmentProcess'>;
  readonly turnEvents: Output<'listTurnEvents'>;
  readonly events: Output<'listRecentEvents'>;
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
        output: await api(
          'showTurn',
          { workspaceId: WorkspaceId.make(workspaceId), mechId: request.mechId, turnId: request.turnId },
          signal,
        ),
      };
    case 'turnEvents':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listTurnEvents',
          {
            workspaceId: WorkspaceId.make(workspaceId),
            mechId: request.mechId,
            turnId: request.turnId,
            after: request.after,
          },
          signal,
        ),
      };
    case 'evidence':
      return {
        kind: request.kind,
        request,
        output: await api(
          'listEvidence',
          {
            workspaceId,
            mechId: request.mechId,
            turnId: Option.some(request.turnId),
            after: Option.fromNullishOr(request.after),
          },
          signal,
        ),
      };
    case 'evidenceArtifact':
      return {
        kind: request.kind,
        request,
        output: await api(
          'showEvidence',
          { workspaceId: WorkspaceId.make(workspaceId), mechId: request.mechId, artifactId: request.artifactId },
          signal,
        ),
      };
    case 'environment':
      return {
        kind: request.kind,
        request,
        output: await api('showEnvironment', { workspaceId, mechId: request.mechId }, signal),
      };
    case 'environmentProcess':
      return {
        kind: request.kind,
        request,
        output: await api('showEnvironmentProcess', { workspaceId, mechId: request.mechId, ...request.handle }, signal),
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

      const activeRevision = newerActiveRevision(
        currentDefinition?.value.active_revision,
        definition.value.active_revision,
      );

      writeMechSummaries(tables, [summary], () => true);
      upsertRows(tables.mechDefinitions, [
        { ...definition, value: { ...definition.value, active_revision: activeRevision } },
      ]);
    },
  });
}

function newerActiveRevision(previous: number | null | undefined, current: number | null): number | null {
  if (previous === undefined || previous === null) {
    return current;
  }

  if (current === null) {
    return previous;
  }

  return Math.max(previous, current);
}

function writeTurns(tables: CanonicalTables, rows: ReadonlyArray<TurnRow>): void {
  for (const row of rows) {
    const previous = tables.turns.get(row.key);

    const incoming = Schema.decodeUnknownResult(Schema.toEncoded(Turn))(row.value);
    const known = Schema.decodeUnknownResult(Schema.toEncoded(Turn))(previous?.value);

    const isOlderVersion =
      Result.isSuccess(incoming) && Result.isSuccess(known) && known.success.version > incoming.success.version;

    const isNonterminalAfterTerminal =
      previous !== undefined &&
      terminalTurnStatuses.has(previous.value.status) &&
      !terminalTurnStatuses.has(row.value.status);

    if (!isNonterminalAfterTerminal && !isOlderVersion) {
      if (Result.isSuccess(incoming) && Result.isSuccess(known)) {
        const notificationIds = new Set([...known.success.notification_ids, ...incoming.success.notification_ids]);

        upsertRows(tables.turns, [{ ...row, value: { ...incoming.success, notification_ids: [...notificationIds] } }]);
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

      const evidence = {
        mechId,
        key,
        value: Schema.encodeSync(TraceEvidence)({ ...answer.output, version: turnVersion(answer.output.turn) }),
      };

      await writeRows({
        signal,
        collections: [tables.turns, tables.traceEvidence],
        write: () => {
          const previous = tables.traceEvidence.get(key)?.value.version;
          const incoming = evidence.value.version;
          const hasKnownVersion = previous !== undefined && previous !== null;

          const isOlderEvidence = hasKnownVersion && incoming !== null && previous > incoming;

          writeTurns(tables, [turn]);

          if (!isOlderEvidence) {
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
    case 'evidence':
    case 'evidenceArtifact': {
      const mechId = answer.request.mechId;
      const artifacts = answer.kind === 'evidence' ? answer.output.artifacts : [answer.output];

      const rows = artifacts.map((artifact) => ({
        mechId,
        key: recordKey(mechId, artifact.artifactId),
        value: Schema.encodeSync(EvidenceArtifact)(artifact),
      }));

      await writeRows({
        signal,
        collections: [tables.evidenceArtifacts],
        write: () => {
          for (const row of rows) {
            const previous = tables.evidenceArtifacts.get(row.key);

            if (previous === undefined || previous.value.status === 'pending') {
              upsertRows(tables.evidenceArtifacts, [row]);
            }
          }
        },
      });

      return {
        ...receipt,
        keys: rows.map((row) => row.key),
        hasMore: answer.kind === 'evidence' ? answer.output.hasMore : null,
      };
    }
    case 'environment': {
      const mechId = answer.request.mechId;
      const row = { mechId, key: mechId, value: Schema.encodeSync(SandboxReport)(answer.output) };

      await writeRows({
        signal,
        collections: [tables.environments],
        write: () => upsertRows(tables.environments, [row]),
      });

      return { ...receipt, keys: [row.key], hasMore: null };
    }
    case 'environmentProcess': {
      const mechId = answer.request.mechId;
      const { handle } = answer.output;
      const identity = JSON.stringify([handle.machineId, handle.processId]);
      const key = recordKey(mechId, identity);
      const row = { mechId, key, value: Schema.encodeSync(ProcessObservation)(answer.output) };

      await writeRows({
        signal,
        collections: [tables.environmentProcessDetails],
        write: () => upsertRows(tables.environmentProcessDetails, [row]),
      });

      return { ...receipt, keys: [key], hasMore: null };
    }
    case 'allowance': {
      const row = { key: 'allowance', value: Schema.encodeSync(Allowance)(answer.output) };

      await writeRows({ signal, collections: [tables.allowance], write: () => upsertRows(tables.allowance, [row]) });

      return { ...receipt, keys: [row.key], hasMore: null };
    }
  }
}
