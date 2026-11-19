import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Storage } from '@earendil-works/pi-durable';
import { MechHistorySourceKind, RequestInvalid } from '@mechane/protocol';
import type { HeldWorkItem, HeldWorkPage } from '@mechane/protocol';
import { Schema } from 'effect';
import type { ActorPageInput, MechScope } from './client.ts';
import {
  Attempts,
  Cancellations,
  Effects,
  ImportedCompletions,
  ImportedHistory,
  Notifications,
  OpenTurns,
  PendingEffects,
  PendingNotifications,
  Routines,
  Turns,
  Wakes,
} from './collections.ts';
import type { ActorRecordReader } from './record-store.ts';
import { decodeStored, NotificationRecord, RoutineRecord, RunRecord, WakeRecord } from './records.ts';
import { State } from './state.ts';
import { readArchivedCompletion } from './store/completions.ts';

const PAGE_MAX_ROWS = 50;
const terminalAttemptPhases: ReadonlySet<string> = new Set(['settled', 'refused']);
const ImportedWorkItem = Schema.Struct({ id: Schema.String, state: Schema.String });

const ImportedRun = Schema.Struct({
  run: Schema.Struct({
    id: Schema.String,
    status: Schema.String,
    inputId: Schema.String,
    endedAt: Schema.NullOr(Schema.String),
  }),
});

const Cursor = Schema.Struct({
  workspaceId: Schema.String,
  mechId: Schema.String,
  section: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

function readCursor(scope: MechScope, after: ActorPageInput['after']) {
  if (after === null || after === undefined) {
    return { ...scope, section: 0, offset: 0 };
  }

  try {
    const position = Schema.decodeUnknownSync(Cursor)(
      JSON.parse(atob(after.replaceAll('-', '+').replaceAll('_', '/'))),
    );

    if (position.workspaceId === scope.workspaceId && position.mechId === scope.mechId) {
      return { ...position };
    }
  } catch {
    // Malformed and foreign cursors get the same scope-safe error.
  }

  throw new RequestInvalid({ reason: 'Invalid held-work cursor for this mech' });
}

type Reader = ActorRecordReader;
type Window = { readonly offset: number; readonly maxRows: number };
type RowPage<T> = { readonly items: ReadonlyArray<T>; readonly hasMore: boolean; readonly nextOffset: number };

function readSection<T>(
  reader: Reader,
  collection: { readonly page: (reader: Reader, input: Window) => Promise<RowPage<T>> },
  summarize: (row: T) => HeldWorkItem | null | Promise<HeldWorkItem | null>,
) {
  return async (window: Window) => {
    const page = await collection.page(reader, window);
    const rows = await Promise.all(page.items.map(async (row) => await summarize(row)));

    return { ...page, scanned: rows.length, items: rows.filter((row) => row !== null) };
  };
}

function required<T>(row: T | undefined): T {
  if (row === undefined) {
    throw new Error('Held-work index points to a missing record');
  }

  return row;
}

type HeldWorkArchive = {
  readonly session: Reader;
  readonly scope: MechScope;
  readonly storage: Pick<DurableObjectStorage, 'get'>;
  readonly records: Pick<Storage, 'submission'>;
};

/** Inspect saved records only. Reconcile external effects by their original IDs before admitting related work. */
export async function listHeldWork(
  { session: reader, scope, storage, records }: HeldWorkArchive,
  input: ActorPageInput,
): Promise<typeof HeldWorkPage.Encoded> {
  const state = await reader.snapshot(State, BACKGROUND_CONTEXT);
  const observedThrough = state?.observedSequence ?? 0;

  const sections = [
    readSection(reader, PendingNotifications, (serialized) => {
      const notification = decodeStored(NotificationRecord, serialized);

      return { kind: 'notification', id: notification.id, status: 'deferred', source: notification.source };
    }),
    readSection(reader, OpenTurns, async (id) => {
      const saved = required(await Turns.get(reader, id));
      const run = decodeStored(RunRecord, saved.value);
      const primary = await Notifications.get(reader, run.inputId);
      const recorded = await records.submission(saved.submissionId, BACKGROUND_CONTEXT);
      const details: { source?: typeof NotificationRecord.Type.source } = {};

      if (primary !== undefined) {
        details.source = decodeStored(NotificationRecord, primary.value).source;
      }

      return {
        kind: 'turn',
        id,
        status: run.status,
        notification_id: run.inputId,
        recorded_outcome: recorded?.status,
        ...details,
      };
    }),
    readSection(reader, PendingEffects, async (id) => {
      const effect = required(await Effects.get(reader, id));
      const terminal = (await readArchivedCompletion(storage, id)) ?? (await ImportedCompletions.get(reader, id));

      return { kind: 'effect', id, turn_id: effect.runId, status: effect.status, recorded_outcome: terminal?.status };
    }),
    readSection(reader, Wakes, (saved) => {
      const wake = decodeStored(WakeRecord, saved.value);

      if (wake.status === 'scheduled') {
        return { kind: 'wake', id: wake.id, status: wake.status, due_at: wake.dueAt };
      }

      return null;
    }),
    readSection(reader, Routines, (saved) => {
      const routine = decodeStored(RoutineRecord, saved.value);

      if (routine.status === 'enabled') {
        return {
          kind: 'routine',
          id: routine.id,
          status: routine.status,
          every_seconds: routine.everySeconds,
          due_at: routine.nextDueAt ?? undefined,
        };
      }

      return null;
    }),
    readSection(reader, Cancellations, (row) => {
      if (row.status === 'pending') {
        return { kind: 'cancellation', id: row.turnId, turn_id: row.turnId, status: row.status };
      }

      return null;
    }),
    readSection(reader, Notifications, (row) => {
      if (row.sequence > observedThrough) {
        const value = decodeStored(NotificationRecord, row.value);

        return { kind: 'notification', id: value.id, status: 'past_observed_sequence', source: value.source };
      }

      return null;
    }),
    // Dispatched attempts are absent from the pending settlement index and still carry spend uncertainty.
    readSection(reader, Attempts, (row) => {
      if (!terminalAttemptPhases.has(row.phase)) {
        return { kind: 'provider_attempt', id: row.id, turn_id: row.turnId, status: row.phase };
      }

      return null;
    }),
    readSection(reader, ImportedHistory, (row) => {
      if (row['kind'] === MechHistorySourceKind.WorkItem) {
        const work = Schema.decodeUnknownSync(ImportedWorkItem)(row['record']);

        if (work.state === 'open') {
          return { kind: 'work_item', id: work.id, status: 'open_at_import' };
        }
      }

      if (row['kind'] === MechHistorySourceKind.Run) {
        const { run } = Schema.decodeUnknownSync(ImportedRun)(row['record']);

        if (run.endedAt === null) {
          return { kind: 'turn', id: run.id, status: run.status, notification_id: run.inputId };
        }
      }

      return null;
    }),
  ];

  const items: Array<HeldWorkItem> = [];
  const cursor = readCursor(scope, input.after);

  if (cursor.section >= sections.length) {
    throw new RequestInvalid({ reason: 'Held-work cursor is beyond the archive' });
  }

  let budget = Math.max(1, Math.min(input.maxRows ?? PAGE_MAX_ROWS, PAGE_MAX_ROWS));
  let section = sections[cursor.section];

  while (section !== undefined && budget > 0) {
    const page = await section({ offset: cursor.offset, maxRows: budget });

    items.push(...page.items);

    budget -= page.scanned;

    if (page.hasMore) {
      cursor.offset = page.nextOffset;
      break;
    }

    cursor.offset = 0;
    cursor.section += 1;
    section = sections[cursor.section];
  }

  if (cursor.section === sections.length) {
    return { items, next_cursor: null };
  }

  const nextCursor = btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replace(/[=]+$/u, '');

  return { items, next_cursor: nextCursor };
}
