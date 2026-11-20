import { Schema } from 'effect';
import type {
  SlotAcquireInput,
  SlotAcquireOutput,
  SlotAttention,
  SlotEpochOutput,
  SlotHeartbeatInput,
  SlotHeartbeatOutput,
  SlotHolderInput,
  SlotRecoverInput,
  SlotReleaseInput,
} from '../protocol.ts';

const HOLD_LEASE_TTL_MS = 45_000;
const PROMISE_LEASE_TTL_MS = 15_000;
const ATTENTION_MAX_ENTRIES = 64;
const QUEUE_SCAN_MAX_ROWS = 256;

const SlotStateRow = Schema.Struct({
  owner_holder_id: Schema.NullOr(Schema.String),
  owner_session_id: Schema.NullOr(Schema.String),
  owner_do_name: Schema.NullOr(Schema.String),
  owner_instance_id: Schema.NullOr(Schema.String),
  owner_state: Schema.NullOr(Schema.Literals(['held', 'promised'])),
  epoch: Schema.Int,
  lease_until_ms: Schema.NullOr(Schema.Int),
  next_sequence: Schema.Int,
});

type SlotState = typeof SlotStateRow.Type;

const QueueHeadRow = Schema.Struct({
  sequence: Schema.Int,
  holder_id: Schema.String,
  session_id: Schema.String,
  do_name: Schema.String,
});

const QueueSessionRow = Schema.Struct({ session_id: Schema.String });

const RetiredRow = Schema.Struct({ holder_id: Schema.String });

type SlotTransition<T> = { readonly value: T; readonly wakeDoName: string | null; readonly alarmAtMs: number | null };

type SlotStorage = Pick<DurableObjectStorage, 'sql' | 'transactionSync' | 'getAlarm' | 'setAlarm' | 'deleteAlarm'>;

export class SlotRetiredError extends Error {
  override readonly name = 'SlotRetiredError';

  constructor() {
    super('The managed session is retired');
  }
}

export function openAgentSlotStore(storage: SlotStorage) {
  const stateFlags = { isInitialized: false };
  const alarmCache: { isKnown: boolean; value: number | null } = { isKnown: false, value: null };

  function ensureSchema(): void {
    if (stateFlags.isInitialized) {
      return;
    }

    storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS slot_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        owner_holder_id TEXT,
        owner_session_id TEXT,
        owner_do_name TEXT,
        owner_instance_id TEXT,
        owner_state TEXT,
        epoch INTEGER NOT NULL,
        lease_until_ms INTEGER,
        next_sequence INTEGER NOT NULL
      )`,
    );

    storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS slot_queue (
        sequence INTEGER PRIMARY KEY,
        holder_id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        do_name TEXT NOT NULL,
        enqueued_at_ms INTEGER NOT NULL
      )`,
    );

    storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS slot_retired (
        holder_id TEXT PRIMARY KEY
      )`,
    );

    storage.sql.exec(
      `INSERT OR IGNORE INTO slot_state (
        singleton, owner_holder_id, owner_session_id, owner_do_name,
        owner_instance_id, owner_state, epoch, lease_until_ms, next_sequence
      ) VALUES (1, NULL, NULL, NULL, NULL, NULL, 0, NULL, 1)`,
    );

    stateFlags.isInitialized = true;
  }

  function readState(): SlotState {
    const cursor = storage.sql.exec(
      `SELECT owner_holder_id, owner_session_id, owner_do_name, owner_instance_id,
              owner_state, epoch, lease_until_ms, next_sequence
       FROM slot_state WHERE singleton = 1`,
    );

    return Schema.decodeUnknownSync(SlotStateRow)(cursor.one());
  }

  function writeState(next: SlotState): void {
    storage.sql.exec(
      `UPDATE slot_state
       SET owner_holder_id = ?,
           owner_session_id = ?,
           owner_do_name = ?,
           owner_instance_id = ?,
           owner_state = ?,
           epoch = ?,
           lease_until_ms = ?,
           next_sequence = ?
       WHERE singleton = 1`,
      next.owner_holder_id,
      next.owner_session_id,
      next.owner_do_name,
      next.owner_instance_id,
      next.owner_state,
      next.epoch,
      next.lease_until_ms,
      next.next_sequence,
    );
  }

  function isRetired(holderId: string): boolean {
    const rows = storage.sql.exec('SELECT holder_id FROM slot_retired WHERE holder_id = ? LIMIT 1', holderId).toArray();

    return rows.length > 0 && Schema.decodeUnknownSync(RetiredRow)(rows[0]).holder_id === holderId;
  }

  function promoteNext(
    current: SlotState,
    now: number,
  ): { readonly state: SlotState; readonly wakeDoName: string | null } {
    const rows = storage.sql
      .exec('SELECT sequence, holder_id, session_id, do_name FROM slot_queue ORDER BY sequence ASC LIMIT 1')
      .toArray();

    if (rows.length === 0) {
      const idle: SlotState = {
        ...current,
        owner_holder_id: null,
        owner_session_id: null,
        owner_do_name: null,
        owner_instance_id: null,
        owner_state: null,
        epoch: current.epoch + 1,
        lease_until_ms: null,
      };

      writeState(idle);

      return { state: idle, wakeDoName: null };
    }

    const head = Schema.decodeUnknownSync(QueueHeadRow)(rows[0]);

    storage.sql.exec('DELETE FROM slot_queue WHERE sequence = ?', head.sequence);

    const promised: SlotState = {
      ...current,
      owner_holder_id: head.holder_id,
      owner_session_id: head.session_id,
      owner_do_name: head.do_name,
      owner_instance_id: null,
      owner_state: 'promised',
      epoch: current.epoch + 1,
      lease_until_ms: now + PROMISE_LEASE_TTL_MS,
    };

    writeState(promised);

    return { state: promised, wakeDoName: head.do_name };
  }

  function reapExpired(now: number): { readonly state: SlotState; readonly wakeDoName: string | null } {
    const current = readState();
    const leaseUntil = current.lease_until_ms;

    if (current.owner_holder_id === null || leaseUntil === null || leaseUntil > now) {
      return { state: current, wakeDoName: null };
    }

    return promoteNext(current, now);
  }

  function alarmTarget(state: SlotState): number | null {
    if (state.owner_holder_id === null) {
      return null;
    }

    return state.lease_until_ms;
  }

  function grantHolder({
    current,
    input,
    nextEpoch,
    now,
    wakeDoName,
  }: {
    readonly current: SlotState;
    readonly input: SlotAcquireInput;
    readonly nextEpoch: number;
    readonly now: number;
    readonly wakeDoName: string | null;
  }): SlotTransition<SlotAcquireOutput> {
    const leaseUntilMs = now + HOLD_LEASE_TTL_MS;

    const next: SlotState = {
      ...current,
      owner_holder_id: input.holderId,
      owner_session_id: input.sessionId,
      owner_do_name: input.doName,
      owner_instance_id: input.instanceId,
      owner_state: 'held',
      epoch: nextEpoch,
      lease_until_ms: leaseUntilMs,
    };

    writeState(next);

    return { value: { status: 'granted', epoch: nextEpoch, leaseUntilMs }, wakeDoName, alarmAtMs: leaseUntilMs };
  }

  function releaseMatchingOwner(
    now: number,
    shouldRelease: (current: SlotState) => boolean,
    beforeRelease?: () => void,
  ): SlotTransition<null> {
    const { state: current, wakeDoName: reapedWake } = reapExpired(now);

    beforeRelease?.();

    if (!shouldRelease(current)) {
      return { value: null, wakeDoName: reapedWake, alarmAtMs: alarmTarget(current) };
    }

    const promoted = promoteNext(current, now);

    return { value: null, wakeDoName: promoted.wakeDoName ?? reapedWake, alarmAtMs: alarmTarget(promoted.state) };
  }

  async function syncAlarm(alarmAtMs: number | null): Promise<void> {
    if (!alarmCache.isKnown) {
      alarmCache.value = await storage.getAlarm();
      alarmCache.isKnown = true;
    }

    if (alarmCache.value === alarmAtMs) {
      return;
    }

    if (alarmAtMs === null) {
      await storage.deleteAlarm();

      alarmCache.value = null;

      return;
    }

    await storage.setAlarm(alarmAtMs);

    alarmCache.value = alarmAtMs;
  }

  async function commit<T>(
    run: () => SlotTransition<T>,
  ): Promise<{ readonly value: T; readonly wakeDoName: string | null }> {
    const transition = storage.transactionSync(() => {
      ensureSchema();

      return run();
    });

    await syncAlarm(transition.alarmAtMs);

    return { value: transition.value, wakeDoName: transition.wakeDoName };
  }

  async function acquire(input: SlotAcquireInput, now: number = Date.now()) {
    return await commit<SlotAcquireOutput>(() => {
      if (isRetired(input.holderId)) {
        throw new SlotRetiredError();
      }

      const { state: current, wakeDoName } = reapExpired(now);

      if (current.owner_holder_id === input.holderId) {
        const isReclaimingStaleHold = current.owner_state === 'held' && current.owner_instance_id !== input.instanceId;

        const nextEpoch: number = (() => {
          if (isReclaimingStaleHold) {
            return current.epoch + 1;
          }

          return current.epoch;
        })();

        return grantHolder({ current, input, nextEpoch, now, wakeDoName });
      }

      if (current.owner_holder_id === null) {
        storage.sql.exec('DELETE FROM slot_queue WHERE holder_id = ?', input.holderId);

        return grantHolder({ current, input, nextEpoch: current.epoch + 1, now, wakeDoName });
      }

      const existing = storage.sql
        .exec('SELECT sequence FROM slot_queue WHERE holder_id = ? LIMIT 1', input.holderId)
        .toArray();

      if (existing.length > 0) {
        storage.sql.exec(
          'UPDATE slot_queue SET session_id = ?, do_name = ? WHERE holder_id = ?',
          input.sessionId,
          input.doName,
          input.holderId,
        );
      } else {
        storage.sql.exec(
          'INSERT INTO slot_queue (sequence, holder_id, session_id, do_name, enqueued_at_ms) VALUES (?, ?, ?, ?, ?)',
          current.next_sequence,
          input.holderId,
          input.sessionId,
          input.doName,
          now,
        );

        writeState({ ...current, next_sequence: current.next_sequence + 1 });
      }

      return {
        value: { status: 'queued', ownerSessionId: current.owner_session_id },
        wakeDoName,
        alarmAtMs: alarmTarget(current),
      };
    });
  }

  async function heartbeat(input: SlotHeartbeatInput, now: number = Date.now()) {
    return await commit<SlotHeartbeatOutput>(() => {
      const { state: current, wakeDoName } = reapExpired(now);
      const isSameHolder = current.owner_holder_id === input.holderId && current.owner_state === 'held';
      const isSameLease = current.owner_instance_id === input.instanceId && current.epoch === input.epoch;

      if (!isSameHolder || !isSameLease) {
        return { value: { status: 'lost' }, wakeDoName, alarmAtMs: alarmTarget(current) };
      }

      const leaseUntilMs = now + HOLD_LEASE_TTL_MS;
      const next: SlotState = { ...current, lease_until_ms: leaseUntilMs };

      writeState(next);

      return { value: { status: 'ok', leaseUntilMs }, wakeDoName, alarmAtMs: leaseUntilMs };
    });
  }

  async function release(input: SlotReleaseInput, now: number = Date.now()) {
    return await commit<null>(() =>
      releaseMatchingOwner(
        now,
        (current) => current.owner_holder_id === input.holderId && current.epoch === input.expectedEpoch,
      ),
    );
  }

  async function recoverInstance(input: SlotRecoverInput, now: number = Date.now()) {
    return await commit<null>(() =>
      releaseMatchingOwner(
        now,
        (current) =>
          current.owner_holder_id === input.holderId &&
          current.owner_state === 'held' &&
          current.owner_instance_id !== input.instanceId,
      ),
    );
  }

  async function evictHolder(holderId: string, now: number, shouldRetire: boolean) {
    return await commit<null>(() =>
      releaseMatchingOwner(
        now,
        (current) => current.owner_holder_id === holderId,
        () => {
          if (shouldRetire) {
            storage.sql.exec('INSERT OR IGNORE INTO slot_retired (holder_id) VALUES (?)', holderId);
          }

          storage.sql.exec('DELETE FROM slot_queue WHERE holder_id = ?', holderId);
        },
      ),
    );
  }

  async function cancel(input: SlotHolderInput, now: number = Date.now()) {
    return await evictHolder(input.holderId, now, false);
  }

  async function remove(input: SlotHolderInput, now: number = Date.now()) {
    return await evictHolder(input.holderId, now, true);
  }

  async function epoch(input: SlotHolderInput, now: number = Date.now()) {
    return await commit<SlotEpochOutput>(() => {
      const { state: current, wakeDoName } = reapExpired(now);
      const isHeldOwner = current.owner_holder_id === input.holderId && current.owner_state === 'held';

      const value: SlotEpochOutput = (() => {
        if (isHeldOwner) {
          return { epoch: current.epoch };
        }

        return { epoch: null };
      })();

      return { value, wakeDoName, alarmAtMs: alarmTarget(current) };
    });
  }

  async function attention(now: number = Date.now()) {
    return await commit<SlotAttention>(() => {
      const { state: current, wakeDoName } = reapExpired(now);

      const rawRows = storage.sql
        .exec('SELECT session_id FROM slot_queue ORDER BY sequence ASC LIMIT ?', QUEUE_SCAN_MAX_ROWS)
        .toArray();

      const seen = new Set<string>();

      if (current.owner_session_id !== null) {
        seen.add(current.owner_session_id);
      }

      const queuedSessionIds: Array<string> = [];

      for (const rawRow of rawRows) {
        const row = Schema.decodeUnknownSync(QueueSessionRow)(rawRow);

        if (!seen.has(row.session_id)) {
          seen.add(row.session_id);
          queuedSessionIds.push(row.session_id);

          if (queuedSessionIds.length >= ATTENTION_MAX_ENTRIES) {
            break;
          }
        }
      }

      return {
        value: { sessionId: current.owner_session_id, queuedSessionIds },
        wakeDoName,
        alarmAtMs: alarmTarget(current),
      };
    });
  }

  async function reapAlarm(now: number = Date.now()) {
    return await commit<null>(() => {
      const { state: current, wakeDoName } = reapExpired(now);

      return { value: null, wakeDoName, alarmAtMs: alarmTarget(current) };
    });
  }

  return { acquire, heartbeat, release, recoverInstance, cancel, remove, epoch, attention, reapAlarm };
}
