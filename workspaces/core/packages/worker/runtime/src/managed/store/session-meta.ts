import { openDurableObjectSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/cloudflare';
import type { DurableObjectSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/cloudflare';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { failManagedRequest } from '../failure.ts';
import { ManagedAgentScope } from '../protocol.ts';

const META_KEY = 'managed.session.meta';
const RETRY_MS = 1000;

export type SessionRoute = {
  readonly id: string;
  readonly publicId: string;
  readonly origin: string | null;
  readonly canCreate: boolean;
  readonly isWrite: boolean;
  readonly isStream?: boolean;
  readonly terminal?: { readonly receipt: string | null; readonly result: unknown };
};

const SessionMetaSchema = Schema.Struct({
  scope: ManagedAgentScope,
  id: Schema.NonEmptyString,
  publicId: Schema.NonEmptyString,
  origin: Schema.NullOr(Schema.String),
  state: Schema.Literals(['live', 'sealed', 'erased']),
  receipt: Schema.NullOr(Schema.String),
  at: Schema.NullOr(Schema.Int),
  revision: Schema.Int,
});

export type SessionMeta = typeof SessionMetaSchema.Type;

export type AdmittedSessionMeta = { readonly row: SessionMeta; readonly isCreated: boolean };

type SessionMetaStorage = DurableObjectSqliteStorage &
  Pick<DurableObjectStorage, 'get' | 'put' | 'deleteAll' | 'transaction' | 'getAlarm' | 'setAlarm' | 'deleteAlarm'>;

type AdmitInput = { readonly scope: ManagedAgentScope; readonly route: SessionRoute };

export function sessionMissing(): never {
  return failManagedRequest(HttpStatusCode.NotFound, 'Unknown managed session');
}

function decodeMeta(raw: unknown): SessionMeta | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return Schema.decodeUnknownSync(SessionMetaSchema)(raw);
}

async function syncAlarm(transaction: DurableObjectTransaction, at: number | null): Promise<void> {
  const current = await transaction.getAlarm();

  if (at === null) {
    if (current !== null) {
      await transaction.deleteAlarm();
    }

    return;
  }

  if (current !== at) {
    await transaction.setAlarm(at);
  }
}

async function armRecovery(transaction: DurableObjectTransaction, row: SessionMeta): Promise<SessionMeta> {
  const recovery = Date.now() + RETRY_MS;

  const next: SessionMeta = { ...row, revision: row.revision + 1, at: Math.min(row.at ?? recovery, recovery) };

  await transaction.put(META_KEY, next);
  await syncAlarm(transaction, next.at);

  return next;
}

export function openManagedSessionMeta(storage: SessionMetaStorage) {
  async function openStorage() {
    return await openDurableObjectSqliteStorage(storage);
  }

  async function read(): Promise<SessionMeta | undefined> {
    return decodeMeta(await storage.get(META_KEY));
  }

  async function admit({ scope, route }: AdmitInput): Promise<AdmittedSessionMeta> {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const prior = decodeMeta(await transaction.get(META_KEY));

      if (prior === undefined && !route.canCreate) {
        return sessionMissing();
      }

      if (prior !== undefined) {
        const hasSameScope = prior.scope.workspaceId === scope.workspaceId && prior.scope.agentId === scope.agentId;

        const hasSameIdentity =
          prior.id === route.id && prior.publicId === route.publicId && prior.origin === route.origin;

        if (!hasSameScope || !hasSameIdentity) {
          return sessionMissing();
        }
      }

      const isCreated = prior === undefined;

      const row: SessionMeta = prior ?? {
        scope,
        id: route.id,
        publicId: route.publicId,
        origin: route.origin,
        state: 'live',
        receipt: null,
        at: null,
        revision: 0,
      };

      if (row.state !== 'live' || !route.isWrite) {
        return { row, isCreated };
      }

      return { row: await armRecovery(transaction, row), isCreated };
    });
  }

  async function wake(): Promise<void> {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = decodeMeta(await transaction.get(META_KEY));

      if (row === undefined || row.state !== 'live') {
        return;
      }

      await armRecovery(transaction, row);
    });
  }

  async function finish(revision: number, at: number | null): Promise<void> {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = decodeMeta(await transaction.get(META_KEY));

      if (row === undefined || row.state !== 'live' || row.revision !== revision) {
        return;
      }

      const next: SessionMeta = { ...row, at };

      await transaction.put(META_KEY, next);
      await syncAlarm(transaction, next.at);
    });
  }

  async function seal(receipt: string | null): Promise<void> {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = decodeMeta(await transaction.get(META_KEY));

      if (row === undefined || row.state === 'erased') {
        return;
      }

      const recovery = Date.now() + RETRY_MS;

      const next: SessionMeta = {
        ...row,
        state: 'sealed',
        receipt: row.receipt ?? receipt,
        revision: row.revision + 1,
        at: recovery,
      };

      await transaction.put(META_KEY, next);
      await syncAlarm(transaction, next.at);
    });
  }

  async function erase(): Promise<void> {
    const row = await read();

    await storage.deleteAll();

    if (row !== undefined) {
      const tombstone: SessionMeta = { ...row, state: 'erased', at: null };

      await storage.put(META_KEY, tombstone);
    }
  }

  async function due(): Promise<SessionMeta | null> {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const row = decodeMeta(await transaction.get(META_KEY));

      if (row === undefined || row.state === 'erased') {
        await syncAlarm(transaction, null);

        return null;
      }

      if (row.state === 'sealed') {
        const recovery = Date.now() + RETRY_MS;
        const next: SessionMeta = { ...row, at: recovery };

        await transaction.put(META_KEY, next);
        await syncAlarm(transaction, recovery);

        return next;
      }

      const now = Date.now();

      if (row.at === null || row.at > now) {
        await syncAlarm(transaction, row.at);

        return null;
      }

      const recovery = now + RETRY_MS;
      const next: SessionMeta = { ...row, at: recovery };

      await transaction.put(META_KEY, next);
      await syncAlarm(transaction, recovery);

      return next;
    });
  }

  return { openStorage, read, admit, wake, finish, seal, erase, due };
}
