import type { MechRow, MechTables } from '@mechane/mech-store';
import { catalog, SandboxRequest, SlackDeliveries, SourceRequest, WatchConfiguration } from '@mechane/protocol';
import { PrincipalId, SlackInboxOrigin, WatchId } from '@mechane/records';
import type {
  CancelDroneInput,
  CancelTurnInput,
  CopyStepInput,
  CreateMechInput,
  DroneInput,
  DronesInput,
  EventsAnswer,
  EventsInput,
  ForkInput,
  MechRevisionsInput,
  MechRpc,
  ObjectSettings,
  ReceiveSlackInboxItemInput,
  SandboxManageInput,
  SendInboxItemInput,
  SetWatchInput,
  SourceManageInput,
  ThreadsInput,
  TurnInput,
  TurnReading,
  UpdateMechInput,
  UpdateWatchStatusInput,
  WatchInput,
  WorkerEnvironment,
} from '@mechane/rpc';
import {
  DroneAnswer,
  DroneCancelAnswer,
  DronesAnswer,
  FindingsAnswer,
  ForkAnswer,
  InboxItemReceipt,
  MechAnswer,
  MechRecord,
  MechRevisionsAnswer,
  MechUpdateAnswer,
  MemoriesAnswer,
  objectSettings,
  SandboxAnswer,
  SourceAnswer,
  ThreadsAnswer,
  TurnCancelAnswer,
  WatchAnswer,
  WatchesAnswer,
} from '@mechane/rpc';
import { serialCalls, wakeList } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Schema } from 'effect';
import { runAlarm } from './alarm/run-alarm.ts';
import { createDefinition } from './definitions/create-definition.ts';
import { projectMechIndex } from './definitions/project-mech-index.ts';
import { updateDefinition } from './definitions/update-definition.ts';
import { decideDroneCancel } from './drones/decide-drone-cancel.ts';
import { readDrone } from './drones/read-drone.ts';
import { readDrones } from './drones/read-drones.ts';
import { listEvents } from './events/list-events.ts';
import { readFindings } from './findings/read-findings.ts';
import { forkMech } from './forks/fork-mech.ts';
import { receiveCopy } from './forks/receive-copy.ts';
import { decideInboxItemReceipt } from './inbox/decide-inbox-item-receipt.ts';
import { mechHandle } from './mech-handle.ts';
import { readMemories } from './memories/read-memories.ts';
import { openMech } from './open-mech.ts';
import { manageSandbox } from './sandboxes/manage-sandbox.ts';
import { receiveSlackItem } from './slack/receive-slack-item.ts';
import { manageSource } from './sources/configuration/manage-source.ts';
import { readThreads } from './threads/read-threads.ts';
import { decideTurnCancel } from './turns/decide-turn-cancel.ts';
import { readTurn } from './turns/read-turn.ts';
import type { AlarmDecision, MechHandle, OpenedMech } from './types.ts';
import { decideWatchStatus } from './watches/decide-watch-status.ts';
import { decideWatch } from './watches/decide-watch.ts';
import { readWatches } from './watches/read-watches.ts';

/**
 * One mech: its record, inbox, turns, threads, drones and event log, and the pi Harness that runs its conversation and
 * its drones'. The Worker calls its methods by RPC, and only its alarm lets pi work; every host statement and every pi
 * commit queue on one database client. The object reads its own ids from its record, never from its name.
 */
export class MechObject extends DurableObject<unknown> implements MechRpc {
  readonly #mech: MechHandle;
  readonly #sourceCalls = serialCalls();

  constructor(state: DurableObjectState, environment: WorkerEnvironment) {
    super(state, environment);

    const signal = wakeList();
    const settings: () => ObjectSettings = () => objectSettings({ environment });

    const open: () => Promise<OpenedMech> = () =>
      state.blockConcurrencyWhile(() => openMech({ state, signal, settings }));

    this.#mech = mechHandle({ open, storage: state.storage });
  }

  async manageSandbox({ request: input }: SandboxManageInput): Promise<typeof SandboxAnswer.Encoded> {
    const mech = await this.#mech.current();
    const request = Schema.decodeUnknownSync(SandboxRequest)(input);
    const answer = await this.ctx.blockConcurrencyWhile(() => manageSandbox({ mech, request }));

    return Schema.encodeSync(SandboxAnswer)(answer);
  }

  async manageSource({ request: encoded, principalId }: SourceManageInput): Promise<typeof SourceAnswer.Encoded> {
    const run: () => Promise<typeof SourceAnswer.Encoded> = async () => {
      const mech = await this.#mech.current();
      const request = Schema.decodeUnknownSync(SourceRequest)(encoded);
      const answer = await manageSource({ mech, request, principalId });

      return Schema.encodeSync(SourceAnswer)(answer);
    };

    return await this.#sourceCalls.run({ run });
  }

  async schemaRevision(): Promise<number> {
    return await this.#mech.atomic({ run: (tables) => tables.schemaRevision() });
  }

  async receiveSlackInboxItem({
    inboxItemId,
    text,
    origin: encoded,
  }: ReceiveSlackInboxItemInput): Promise<typeof InboxItemReceipt.Encoded> {
    const origin = Schema.decodeUnknownSync(SlackInboxOrigin)(encoded);
    const now = DateTime.nowUnsafe();

    const receive: (tables: MechTables) => AlarmDecision<InboxItemReceipt> = (tables) =>
      receiveSlackItem({ store: tables, inboxItemId, text, origin, now });

    const receipt = await this.#mech.recordForAlarm({ run: receive });

    return Schema.encodeSync(InboxItemReceipt)(receipt);
  }

  async slackDeliveries(): Promise<typeof SlackDeliveries.Encoded> {
    const deliveries = await this.#mech.atomic({ run: (tables) => tables.slackDeliveries() });

    return Schema.encodeSync(SlackDeliveries)({ deliveries });
  }

  async setWatch({
    watchId: encodedId,
    configuration: encoded,
    creatorId: encodedCreator,
  }: SetWatchInput): Promise<typeof WatchAnswer.Encoded> {
    const watchId = Schema.decodeUnknownSync(WatchId)(encodedId);
    const creatorId = Schema.decodeUnknownSync(PrincipalId)(encodedCreator);
    const configuration = Schema.decodeUnknownSync(WatchConfiguration)(encoded);
    const now = DateTime.nowUnsafe();

    const decide: (tables: MechTables) => AlarmDecision<WatchAnswer> = (store) =>
      decideWatch({ store, watchId, configuration, creatorId, now });

    const answer = await this.#mech.recordForAlarm({ run: decide });

    return Schema.encodeSync(WatchAnswer)(answer);
  }

  async watchStatus({ watchId: encodedId, status }: UpdateWatchStatusInput): Promise<typeof WatchAnswer.Encoded> {
    const watchId = Schema.decodeUnknownSync(WatchId)(encodedId);
    const now = DateTime.nowUnsafe();

    const decide: (tables: MechTables) => AlarmDecision<WatchAnswer> = (store) =>
      decideWatchStatus({ store, watchId, status, now });

    const answer = await this.#mech.recordForAlarm({ run: decide });

    return Schema.encodeSync(WatchAnswer)(answer);
  }

  async watches(): Promise<typeof WatchesAnswer.Encoded> {
    const answer = await this.#mech.atomic({ run: (store) => readWatches({ store }) });

    return Schema.encodeSync(WatchesAnswer)(answer);
  }

  async findings({ watchId: encodedId }: WatchInput): Promise<typeof FindingsAnswer.Encoded> {
    const watchId = Schema.decodeUnknownSync(WatchId)(encodedId);
    const answer = await this.#mech.atomic({ run: (store) => readFindings({ store, watchId }) });

    return Schema.encodeSync(FindingsAnswer)(answer);
  }

  async create({ ...input }: CreateMechInput): Promise<typeof MechRecord.Encoded> {
    const now = DateTime.nowUnsafe();

    const create: (tables: MechTables) => AlarmDecision<MechRow> = (tables) =>
      createDefinition({ store: tables, input, now });

    const created = await this.#mech.recordForAlarm({ run: create });

    return Schema.encodeSync(MechRecord)(created);
  }

  async show(): Promise<typeof MechAnswer.Encoded> {
    const current = await this.#mech.atomic({ run: (tables) => tables.mech() });

    const answer = Option.match(current, {
      onSome: (mech) => MechAnswer.cases.Found.make({ mech }),
      onNone: () => MechAnswer.cases.MechMissing.make({}),
    });

    return Schema.encodeSync(MechAnswer)(answer);
  }

  async update({ change, updaterId }: UpdateMechInput): Promise<typeof MechUpdateAnswer.Encoded> {
    const now = DateTime.nowUnsafe();
    const definition = Schema.decodeUnknownSync(catalog.updateMech.body)(change);
    const actor = PrincipalId.make(updaterId);

    const run: (tables: MechTables) => AlarmDecision<MechUpdateAnswer> = (tables) =>
      updateDefinition({ store: tables, now, ...definition, updaterId: actor });

    const answer = await this.#mech.recordForAlarm({ run });

    const opened = await this.#mech.current();

    await projectMechIndex(opened);

    return Schema.encodeSync(MechUpdateAnswer)(answer);
  }

  async revisions({ after }: MechRevisionsInput): Promise<typeof MechRevisionsAnswer.Encoded> {
    const run: (tables: MechTables) => MechRevisionsAnswer = (tables) => {
      const mech = tables.mech();

      if (Option.isNone(mech)) {
        return MechRevisionsAnswer.cases.MechMissing.make({});
      }

      const revisions = tables.mechRevisions({ after });

      return MechRevisionsAnswer.cases.Listed.make(revisions);
    };

    const answer = await this.#mech.atomic({ run });

    return Schema.encodeSync(MechRevisionsAnswer)(answer);
  }

  /** Records the item and its event; the alarm delivers it. */
  async sendInboxItem({
    inboxItemId,
    text,
    delivery,
    senderId,
  }: SendInboxItemInput): Promise<typeof InboxItemReceipt.Encoded> {
    const now = DateTime.nowUnsafe();

    const receive: (tables: MechTables) => AlarmDecision<InboxItemReceipt> = (tables) =>
      decideInboxItemReceipt({ store: tables, inboxItemId, text, delivery, senderId, now });

    return Schema.encodeSync(InboxItemReceipt)(await this.#mech.recordForAlarm({ run: receive }));
  }

  /** Records a member's cancel of a running turn; the alarm alone stops the turn's work. */
  async cancelTurn({ turnId, cancelerId }: CancelTurnInput): Promise<typeof TurnCancelAnswer.Encoded> {
    const now = DateTime.nowUnsafe();

    const cancel: (tables: MechTables) => AlarmDecision<TurnCancelAnswer> = (tables) =>
      decideTurnCancel({ store: tables, turnId, cancelerId, now });

    return Schema.encodeSync(TurnCancelAnswer)(await this.#mech.recordForAlarm({ run: cancel }));
  }

  async events({ after, waitMs }: EventsInput): Promise<typeof EventsAnswer.Encoded> {
    const { store, signal } = await this.#mech.current();
    const deadline = DateTime.addDuration(DateTime.nowUnsafe(), Duration.millis(waitMs));

    return await listEvents({ store, signal, after, deadline });
  }

  async turn({ turnId }: TurnInput): Promise<TurnReading> {
    return await this.#mech.atomic({ run: (tables) => readTurn({ store: tables, turnId }) });
  }

  async memories(): Promise<typeof MemoriesAnswer.Encoded> {
    return Schema.encodeSync(MemoriesAnswer)(
      await this.#mech.atomic({ run: (tables) => readMemories({ store: tables }) }),
    );
  }

  async threads({ query }: ThreadsInput): Promise<typeof ThreadsAnswer.Encoded> {
    const { after } = Schema.decodeUnknownSync(catalog.listThreads.query)(query);

    const page = await this.#mech.atomic({ run: (tables) => readThreads({ store: tables, after }) });

    return Schema.encodeSync(ThreadsAnswer)(page);
  }

  async drones({ query }: DronesInput): Promise<typeof DronesAnswer.Encoded> {
    const { after } = Schema.decodeUnknownSync(catalog.listDrones.query)(query);

    const page = await this.#mech.atomic({ run: (tables) => readDrones({ store: tables, after }) });

    return Schema.encodeSync(DronesAnswer)(page);
  }

  async drone({ droneId }: DroneInput): Promise<typeof DroneAnswer.Encoded> {
    return Schema.encodeSync(DroneAnswer)(
      await this.#mech.atomic({ run: (tables) => readDrone({ store: tables, droneId }) }),
    );
  }

  /** Records a member's cancel of a running drone; the alarm alone stops the drone's work. */
  async cancelDrone({ droneId, cancelerId }: CancelDroneInput): Promise<typeof DroneCancelAnswer.Encoded> {
    const now = DateTime.nowUnsafe();

    const cancel: (tables: MechTables) => AlarmDecision<DroneCancelAnswer> = (tables) =>
      decideDroneCancel({ store: tables, droneId, cancelerId, now });

    return Schema.encodeSync(DroneCancelAnswer)(await this.#mech.recordForAlarm({ run: cancel }));
  }

  /** Forks the mech while no other event of its object runs, so the copy reads one point of its life. */
  async fork({ forkId, name, requesterId }: ForkInput): Promise<typeof ForkAnswer.Encoded> {
    const mech = await this.#mech.current();

    const answer = await this.ctx.blockConcurrencyWhile(() => forkMech({ mech, forkId, name, requesterId }));

    return Schema.encodeSync(ForkAnswer)(answer);
  }

  /** Applies one step of a fork's copy from the mech it copies: its begin, a page of rows, or its end. */
  async receiveCopy({ step }: CopyStepInput): Promise<void> {
    await receiveCopy({ handle: this.#mech, step });
  }

  /** Lets pi work in the alarm's event for at most the alarm's work seconds, then hands pi to the next alarm. */
  override async alarm(): Promise<void> {
    await runAlarm({ handle: this.#mech });
  }
}
