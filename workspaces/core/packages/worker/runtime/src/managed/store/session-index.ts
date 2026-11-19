import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { failManagedRequest } from '../failure.ts';
import { ManagedAgentScope } from '../protocol.ts';

const SCOPE_KEY = 'managed-agent-scope';
const WAKE_KEY_WIDTH = 16;
const WAKE_BATCH_ROWS = 16;
const RECORD = 'managed.session:';
const WAKE = 'managed.wake:';
const RETRY_MS = 1000;
type Wake = { readonly id: string; readonly at: number };

type SessionRecord = {
  readonly publicId: string;
  readonly origin: string | null;
  readonly state: 'live' | 'sealed' | 'erased';
  readonly receipt: string | null;
  readonly at: number | null;
  readonly revision: number;
};

function dueKey(id: string, at: number) {
  return `${WAKE}${String(at).padStart(WAKE_KEY_WIDTH, '0')}:${id}`;
}

export function sessionMissing(): never {
  return failManagedRequest(HttpStatusCode.NotFound, 'Unknown managed session');
}

async function arm(transaction: DurableObjectTransaction) {
  const wakes = await transaction.list<Wake>({ prefix: WAKE, limit: 1 });
  const first = wakes.values().next().value;
  const current = await transaction.getAlarm();

  if (first === undefined) {
    if (current !== null) {
      await transaction.deleteAlarm();
    }
  } else if (current !== first.at) {
    await transaction.setAlarm(first.at);
  }
}

async function save(
  transaction: DurableObjectTransaction,
  id: string,
  { previous, row }: { readonly previous: SessionRecord | undefined; readonly row: SessionRecord },
) {
  if (previous?.at !== undefined && previous.at !== null && previous.at !== row.at) {
    await transaction.delete(dueKey(id, previous.at));
  }

  if (row.at !== null) {
    await transaction.put(dueKey(id, row.at), { id, at: row.at });
  }

  await transaction.put(RECORD + id, row);
  await arm(transaction);
}

export function openManagedSessionIndex(storage: Pick<DurableObjectStorage, 'get' | 'put' | 'transaction'>) {
  async function savedScope(): Promise<ManagedAgentScope | undefined> {
    const value = await storage.get(SCOPE_KEY);

    if (value === undefined) {
      return;
    }

    return Schema.decodeUnknownSync(ManagedAgentScope)(value);
  }

  async function rememberScope(scope: ManagedAgentScope) {
    await storage.put(SCOPE_KEY, scope);
  }

  async function read(id: string) {
    return await storage.get<SessionRecord>(RECORD + id);
  }

  async function admit({
    id,
    publicId,
    origin,
    canCreate,
    isWrite,
  }: {
    readonly id: string;
    readonly publicId: string;
    readonly origin: string | null;
    readonly canCreate: boolean;
    readonly isWrite: boolean;
  }) {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const prior = await transaction.get<SessionRecord>(RECORD + id);

      if (prior === undefined && !canCreate) {
        return sessionMissing();
      }

      if (prior !== undefined && (prior.origin !== origin || prior.publicId !== publicId)) {
        return sessionMissing();
      }

      const row: SessionRecord = prior ?? { publicId, origin, state: 'live', receipt: null, at: null, revision: 0 };

      if (row.state !== 'live' || !isWrite) {
        return row;
      }

      const recovery = Date.now() + RETRY_MS;
      const next = { ...row, revision: row.revision + 1, at: Math.min(row.at ?? recovery, recovery) };

      await save(transaction, id, { previous: prior, row: next });

      return next;
    });
  }

  async function wake(id: string) {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = await transaction.get<SessionRecord>(RECORD + id);

      if (row === undefined || row.state !== 'live') {
        return;
      }

      const recovery = Date.now() + RETRY_MS;

      await save(transaction, id, {
        previous: row,
        row: { ...row, revision: row.revision + 1, at: Math.min(row.at ?? recovery, recovery) },
      });
    });
  }

  async function finish(id: string, revision: number, at: number | null) {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = await transaction.get<SessionRecord>(RECORD + id);

      if (row === undefined || row.state !== 'live' || row.revision !== revision) {
        return;
      }

      await save(transaction, id, { previous: row, row: { ...row, at } });
    });
  }

  async function attention(slot: { readonly owner: string | null; readonly waiting: ReadonlyArray<string> }) {
    const ids = new Set(slot.waiting);

    if (slot.owner !== null) {
      ids.add(slot.owner);
    }

    if (ids.size === 0) {
      return { sessionId: null, queuedSessionIds: [] };
    }

    const rows = await storage.get<SessionRecord>(Array.from(ids, (id) => RECORD + id));

    function publicId(id: string | null) {
      if (id === null) {
        return null;
      }

      const row = rows.get(RECORD + id);

      if (row?.state === 'live') {
        return row.publicId;
      }

      return null;
    }

    const sessionId = publicId(slot.owner);
    const waiting = slot.waiting.map(publicId).filter((id) => id !== null && id !== sessionId);

    return { sessionId, queuedSessionIds: [...new Set(waiting)] };
  }

  async function seal(id: string, receipt: string | null) {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = await transaction.get<SessionRecord>(RECORD + id);

      if (row === undefined || row.state === 'erased') {
        return sessionMissing();
      }

      await save(transaction, id, {
        previous: row,
        row: { ...row, state: 'sealed', receipt, at: Date.now() + RETRY_MS },
      });
    });
  }

  async function erased(id: string) {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = await transaction.get<SessionRecord>(RECORD + id);

      if (row?.state !== 'sealed') {
        throw new Error('Managed session erasure lost its seal');
      }

      await save(transaction, id, { previous: row, row: { ...row, state: 'erased', at: null } });
    });
  }

  async function due() {
    const now = Date.now();

    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const rows = await transaction.list<Wake>({ prefix: WAKE, end: dueKey('', now + 1), limit: WAKE_BATCH_ROWS });
      const ids = Array.from(rows.values(), (row) => row.id);

      for (const id of ids) {
        const row = await transaction.get<SessionRecord>(RECORD + id);

        if (row === undefined || row.at === null) {
          throw new Error('Managed session wake index lost its identity');
        }

        await transaction.delete(dueKey(id, row.at));

        const recovery = now + RETRY_MS;

        await transaction.put(dueKey(id, recovery), { id, at: recovery });
        await transaction.put(RECORD + id, { ...row, at: recovery });
      }

      await arm(transaction);

      return ids;
    });
  }

  return { admit, read, wake, finish, seal, erased, due, attention, savedScope, rememberScope };
}
