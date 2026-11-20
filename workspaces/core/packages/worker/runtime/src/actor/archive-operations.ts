import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { Conversation, Session, Storage } from '@earendil-works/pi-durable';
import type { ControlStore } from '@mechane/control-store';
import { catalog, MechHistoryImportBatch, RequestConflict } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { SandboxCompletion } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { archiveCompletion } from '../execution/completion.ts';
import { historyPage } from '../views/history.ts';
import {
  listConsoleMessages,
  listEvents,
  listRuns,
  readCancellation,
  readRun,
  readTrace,
} from '../views/projections.ts';
import { listRoutines, readRoutine } from '../views/routines.ts';
import { acknowledgeArchiveControlChange } from './archive-control.ts';
import { listHeldWork } from './archive-held.ts';
import { importArchiveHistory } from './archive-import.ts';
import { archiveStatus, inspectArchive } from './archive-inspection.ts';
import type { MechScope } from './client.ts';
import type { ActorState } from './state.ts';
import { listArchivedCompletions } from './store/completions.ts';

const ControlChange = Schema.Struct({
  id: RecordId,
  sourceSequence: Schema.Int,
  kind: Schema.String,
  revision: Schema.optionalKey(Schema.Int),
  payloadDigest: Schema.optionalKey(Schema.String),
});

const Page = Schema.Struct({
  after: Schema.optionalKey(Schema.NullOr(Schema.String)),
  maxRows: Schema.optionalKey(Schema.Int),
});

const EventRange = Schema.Struct({
  beforeSequence: Schema.optionalKey(Schema.Int),
  afterSequence: Schema.optionalKey(Schema.Int),
  maxRows: Schema.optionalKey(Schema.Int),
  runId: Schema.optionalKey(Schema.String),
  isNewestFirst: Schema.optionalKey(Schema.Boolean),
});

const RunPage = Schema.Struct({
  ...Page.fields,
  search: catalog.listTurns.query.fields.search,
  filter: catalog.listTurns.query.fields.filter,
});

const Turn = Schema.Struct({ turnId: RecordId });
const Routine = Schema.Struct({ routineId: RecordId });

type Archive = {
  readonly scope: MechScope;
  readonly state: ActorState | undefined;
  readonly session: Session;
  readonly records: Storage;
  readonly storage: DurableObjectStorage;
  readonly configuration: () => Promise<RuntimeConfiguration>;
  readonly withControl: <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;
};

export async function archiveOperation(archive: Archive, method: string, input: Readonly<Record<string, unknown>>) {
  const { session, scope, state, records, storage, configuration, withControl } = archive;
  const view = { scope, harness: session, withControl };

  switch (method) {
    case 'status':
      return archiveStatus(scope, state);
    case 'maintenance':
      if (input['action'] !== 'quiesce') {
        throw new RequestConflict({ reason: 'This archived mech is permanently quiesced' });
      }

      return await inspectArchive(archive);
    case 'listHistory': {
      const page = Schema.decodeUnknownSync(Page)(input);
      const root = await records.conversation(ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT);

      if (root === undefined) {
        return await historyPage(view, page);
      }

      const conversation: Pick<Conversation, 'entries'> = {
        entries: (query, ...pageOptions) => records.scanEntries({ ...query, conversationId: root.id }, ...pageOptions),
      };

      return await historyPage({ ...view, conversation }, page);
    }
    case 'listHeldWork':
      return await listHeldWork(archive, Schema.decodeUnknownSync(Page)(input));
    case 'listArchivedCompletions':
      return await listArchivedCompletions(storage, Schema.decodeUnknownSync(Page)(input));
    case 'listRuns':
      return await listRuns(view, Schema.decodeUnknownSync(RunPage)(input));
    case 'readRun':
      return await readRun(view, Schema.decodeUnknownSync(Turn)(input));
    case 'readTrace':
      return await readTrace(view, Schema.decodeUnknownSync(Turn)(input));
    case 'readCancellation':
      return await readCancellation(view, Schema.decodeUnknownSync(Turn)(input));
    case 'listEvents':
      return await listEvents(view, Schema.decodeUnknownSync(EventRange)(input));
    case 'listConsoleMessages':
      return await listConsoleMessages(view, Schema.decodeUnknownSync(EventRange)(input));
    case 'listRoutines':
      return await listRoutines(view, Schema.decodeUnknownSync(Page)(input));
    case 'readRoutine':
      return await readRoutine(view, Schema.decodeUnknownSync(Routine)(input));
    case 'applyControlChange':
      return await acknowledgeArchiveControlChange(session, scope, Schema.decodeUnknownSync(ControlChange)(input));
    case 'importHistory':
      return await importArchiveHistory(session, scope, Schema.decodeUnknownSync(MechHistoryImportBatch)(input));
    case 'acceptCompletion':
      return await archiveCompletion(
        { ...view, storage, configuration: await configuration() },
        Schema.decodeUnknownSync(SandboxCompletion)(input),
      );
    default:
      throw new RequestConflict({ reason: 'Create a managed session to run new work' });
  }
}
