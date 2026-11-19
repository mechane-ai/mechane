const HEADER = 'managed.identity.slot';
const QUEUE = 'managed.identity.queue:';
const TICKET = 'managed.identity.ticket:';
const RETIRED = 'managed.identity.retired:';
const ATTENTION_MAX_ENTRIES = 64;
const RECOVERY_BATCH = 64;
const QUEUE_ORDINAL_WIDTH = 16;

type Header = { readonly owner: string | null; readonly epoch: number; readonly sequence: number };

type Store = Pick<DurableObjectStorage, 'get' | 'transaction'>;

async function header(transaction: DurableObjectTransaction): Promise<Header> {
  return (await transaction.get<Header>(HEADER)) ?? { owner: null, epoch: 0, sequence: 0 };
}

async function unticket(transaction: DurableObjectTransaction, id: string): Promise<void> {
  const key = await transaction.get<string>(TICKET + id);

  if (key === undefined) {
    return;
  }

  await transaction.delete([key, TICKET + id]);
}

async function first(transaction: DurableObjectTransaction): Promise<string | null> {
  const next = await transaction.list<string>({ prefix: QUEUE, limit: 1 });

  return next.values().next().value ?? null;
}

async function grant(transaction: DurableObjectTransaction, state: Header): Promise<Header> {
  if (state.owner !== null) {
    return state;
  }

  const next = await first(transaction);

  if (next === null) {
    return state;
  }

  await unticket(transaction, next);

  return { ...state, owner: next, epoch: state.epoch + 1 };
}

async function pass(transaction: DurableObjectTransaction, current: Header): Promise<string | null> {
  const next = await grant(transaction, { ...current, owner: null });

  await transaction.put(HEADER, next);

  return next.owner;
}

async function ticket(transaction: DurableObjectTransaction, id: string, sequence: number): Promise<number> {
  if ((await transaction.get(TICKET + id)) !== undefined) {
    return sequence;
  }

  const next = sequence + 1;

  if (!Number.isSafeInteger(next)) {
    throw new TypeError('The managed identity ticket sequence is exhausted');
  }

  const key = QUEUE + String(next).padStart(QUEUE_ORDINAL_WIDTH, '0');

  await transaction.put({ [TICKET + id]: key, [key]: id });

  return next;
}

async function clearQueuedTickets(transaction: DurableObjectTransaction): Promise<number> {
  const pending = await transaction.list<string>({ prefix: QUEUE, limit: RECOVERY_BATCH });

  if (pending.size === 0) {
    return 0;
  }

  const keys = Array.from(pending).flatMap(([key, id]) => [key, TICKET + id]);

  await transaction.delete(keys);

  return pending.size;
}

export function openIdentitySlotStore(storage: Store) {
  async function request(id: string): Promise<number | null> {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      if ((await transaction.get(RETIRED + id)) !== undefined) {
        throw new Error('Managed session was retired');
      }

      const previous = await header(transaction);

      if (previous.owner === id) {
        return previous.epoch;
      }

      const sequence = await ticket(transaction, id, previous.sequence);
      const result = await grant(transaction, { ...previous, sequence });
      const changed = result.owner !== previous.owner || result.sequence !== previous.sequence;

      if (changed) {
        await transaction.put(HEADER, result);
      }

      if (result.owner === id) {
        return result.epoch;
      }

      return null;
    });
  }

  async function release(id: string, expectedEpoch: number): Promise<string | null> {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const current = await header(transaction);

      if (current.owner !== id || current.epoch !== expectedEpoch) {
        return null;
      }

      return await pass(transaction, current);
    });
  }

  async function cancelWait(id: string): Promise<string | null> {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      await unticket(transaction, id);

      const current = await header(transaction);

      if (current.owner !== id) {
        return null;
      }

      // The previous owner may have passed us the grant while our waiter was aborting.
      return await pass(transaction, current);
    });
  }

  async function remove(id: string): Promise<string | null> {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      await transaction.put(RETIRED + id, true);
      await unticket(transaction, id);

      const current = await header(transaction);

      if (current.owner !== id) {
        return null;
      }

      return await pass(transaction, current);
    });
  }

  async function epoch(id: string): Promise<number | null> {
    const value = await storage.get<Header>(HEADER);

    if (value?.owner === id) {
      return value.epoch;
    }

    return null;
  }

  async function recover(): Promise<void> {
    await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const current = await header(transaction);

      // Waiters belong to the previous process. Durable Pi work re-enters the queue on recovery.
      let removedTickets = await clearQueuedTickets(transaction);

      while (removedTickets > 0) {
        removedTickets = await clearQueuedTickets(transaction);
      }

      await transaction.put(HEADER, { ...current, owner: null, epoch: current.epoch + 1 });
    });
  }

  async function attention() {
    return await storage.transaction(async (transaction: DurableObjectTransaction) => {
      const current = await header(transaction);
      const waiters = await transaction.list<string>({ prefix: QUEUE, limit: ATTENTION_MAX_ENTRIES });
      const waiting = Array.from(waiters.values());

      return { owner: current.owner, waiting };
    });
  }

  return { request, release, cancelWait, remove, epoch, attention, recover };
}
