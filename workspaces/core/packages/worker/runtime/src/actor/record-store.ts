import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Context } from '@earendil-works/chord/context';
import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import { RequestInvalid } from '@mechane/protocol';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Schema } from 'effect';
import { decodeStored } from './records.ts';

const DOCUMENT_MAX_MEBIBYTES = 7;
const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MEBIBYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const RECORD_PAGE_ROWS = 100;

const ValueFormat = Schema.Struct({ ordinal: Schema.NullOr(Schema.Number), value: Schema.NullOr(Schema.String) });
const OrderFormat = Schema.Struct({ id: Schema.NullOr(Schema.String) });

const Values = defineDocFamily<typeof ValueFormat.Type, null>({
  kind: 'mechane.record-value',
  version: 1,
  family: true,
  scope: 'session',
  initial: () => ({ ordinal: null, value: null }),
  checkpointWhen: () => true,
});

const Order = defineDocFamily<typeof OrderFormat.Type, null>({
  kind: 'mechane.record-order',
  version: 1,
  family: true,
  scope: 'session',
  initial: () => ({ id: null }),
  checkpointWhen: () => true,
});

const Catalog = defineDocFamily({
  kind: 'mechane.record-catalog',
  version: 1,
  family: true,
  scope: 'session',
  initial: (_seed: null) => ({ total: 0, live: 0, first: 0 }),
  checkpointWhen: () => true,
});

export type ActorRecordReader = Pick<Harness, 'snapshot'>;

export type ActorRecordPageInput = {
  readonly after?: string | undefined;
  readonly offset?: number | undefined;
  readonly maxRows?: number | undefined;
  readonly isReversed?: boolean | undefined;
};

function address(name: string, key: string | number): string {
  return JSON.stringify([name, key]);
}

function serialize<T>(schema: Schema.Codec<T, unknown>, value: T): string {
  const serialized: unknown = JSON.stringify(Schema.encodeSync(schema)(value));

  if (typeof serialized !== 'string') {
    throw new TypeError('The actor record is not serializable JSON');
  }

  const document = JSON.stringify({ ordinal: Number.MAX_SAFE_INTEGER, value: serialized });

  if (new TextEncoder().encode(document).byteLength > DOCUMENT_MAX_BYTES) {
    throw new RequestInvalid({ reason: 'The actor record exceeds its document size limit' });
  }

  return serialized;
}

type CollectionDefinition<T> = {
  readonly name: string;
  readonly schema: Schema.Codec<T, unknown>;
  readonly removal: 'retain_order' | 'dense';
};

function createCollection<T>({ name, schema, removal }: CollectionDefinition<T>) {
  async function read(transaction: Tx, id: string): Promise<T | undefined> {
    const row = await transaction.doc(Values, address(name, id), null);

    if (row.value === null) {
      return undefined;
    }

    return decodeStored(schema, row.value);
  }

  async function get(
    reader: ActorRecordReader,
    id: string,
    context: Context = BACKGROUND_CONTEXT,
  ): Promise<T | undefined> {
    const row = await reader.snapshot(Values, address(name, id), context);

    if (row?.value === undefined || row.value === null) {
      return undefined;
    }

    return decodeStored(schema, row.value);
  }

  async function put(transaction: Tx, id: string, value: T): Promise<void> {
    const serialized = serialize(schema, value);
    const row = await transaction.doc(Values, address(name, id), null);
    const catalog = await transaction.doc(Catalog, name, null);

    if (row.ordinal === null) {
      const ordinal = catalog.total;
      const order = await transaction.doc(Order, address(name, ordinal), null);
      order.id = id;
      row.ordinal = ordinal;
      catalog.total += 1;
    }

    if (row.value === null) {
      catalog.live += 1;
      catalog.first = Math.min(catalog.first, row.ordinal);
    }

    row.value = serialized;
  }

  async function append(transaction: Tx, value: T): Promise<string> {
    const catalog = await transaction.doc(Catalog, name, null);
    const id = String(catalog.total);

    await put(transaction, id, value);

    return id;
  }

  async function remove(transaction: Tx, id: string): Promise<void> {
    const row = await transaction.doc(Values, address(name, id), null);

    if (row.value === null) {
      return;
    }

    row.value = null;
    const catalog = await transaction.doc(Catalog, name, null);
    catalog.live -= 1;

    if (removal === 'dense') {
      const lastOrdinal = catalog.total - 1;
      const last = await transaction.doc(Order, address(name, lastOrdinal), null);

      if (row.ordinal !== lastOrdinal && last.id !== null) {
        const moved = await transaction.doc(Values, address(name, last.id), null);
        const destination = await transaction.doc(Order, address(name, row.ordinal ?? 0), null);
        destination.id = last.id;
        moved.ordinal = row.ordinal;
      }

      last.id = null;
      row.ordinal = null;
      catalog.total -= 1;
      catalog.first = 0;

      return;
    }

    if (catalog.live === 0) {
      catalog.first = catalog.total;
    } else if (row.ordinal === catalog.first) {
      while (catalog.first < catalog.total) {
        const order = await transaction.doc(Order, address(name, catalog.first), null);

        if (order.id === null) {
          throw new Error('The actor record index has a missing identity');
        }

        const candidate = await transaction.doc(Values, address(name, order.id), null);

        if (candidate.value !== null) {
          break;
        }

        catalog.first += 1;
      }
    }
  }

  async function count(reader: ActorRecordReader, context: Context = BACKGROUND_CONTEXT): Promise<number> {
    const catalog = await reader.snapshot(Catalog, name, context);

    return catalog?.live ?? 0;
  }

  async function countInTransaction(transaction: Tx): Promise<number> {
    const catalog = await transaction.doc(Catalog, name, null);

    return catalog.live;
  }

  async function totalInTransaction(transaction: Tx): Promise<number> {
    const catalog = await transaction.doc(Catalog, name, null);

    return catalog.total;
  }

  async function at(
    reader: ActorRecordReader,
    ordinal: number,
    context: Context = BACKGROUND_CONTEXT,
  ): Promise<T | undefined> {
    const order = await reader.snapshot(Order, address(name, ordinal), context);

    if (order?.id === undefined || order.id === null) {
      return undefined;
    }

    return await get(reader, order.id, context);
  }

  async function readAt(transaction: Tx, ordinal: number): Promise<T | undefined> {
    const order = await transaction.doc(Order, address(name, ordinal), null);

    if (order.id === null) {
      return undefined;
    }

    return await read(transaction, order.id);
  }

  async function lastInTransaction(transaction: Tx): Promise<T | undefined> {
    const catalog = await transaction.doc(Catalog, name, null);
    const position = { value: catalog.total - 1 };

    while (position.value >= catalog.first) {
      const value = await readAt(transaction, position.value);

      if (value !== undefined) {
        return value;
      }

      position.value -= 1;
    }

    return undefined;
  }

  async function page(reader: ActorRecordReader, input: ActorRecordPageInput, context: Context = BACKGROUND_CONTEXT) {
    const catalog = await reader.snapshot(Catalog, name, context);
    const total = catalog?.total ?? 0;
    const first = catalog?.first ?? 0;
    let direction = 1;
    let position = Math.max(first, input.offset ?? first);

    if (input.isReversed === true) {
      direction = -1;
      position = Math.min(total - 1, input.offset ?? total - 1);
    }

    if (input.after !== undefined) {
      const row = await reader.snapshot(Values, address(name, input.after), context);

      if (row?.ordinal === undefined || row.ordinal === null) {
        throw new RequestInvalid({ reason: 'The page cursor does not belong to this collection' });
      }

      if (direction === 1) {
        position = Math.max(first, row.ordinal + direction);
      } else {
        position = Math.min(total - 1, row.ordinal + direction);
      }
    }

    const items: Array<T> = [];
    const maxRows = input.maxRows ?? RECORD_PAGE_ROWS;

    while (position >= first && position < total && items.length < maxRows) {
      const value = await at(reader, position, context);
      position += direction;

      if (value !== undefined) {
        items.push(value);
      }
    }

    while (position >= first && position < total) {
      const value = await at(reader, position, context);

      if (value !== undefined) {
        return { items, hasMore: true, nextOffset: position };
      }

      position += direction;
    }

    return { items, hasMore: false, nextOffset: position };
  }

  async function all(reader: ActorRecordReader, context: Context = BACKGROUND_CONTEXT): Promise<ReadonlyArray<T>> {
    const items: Array<T> = [];
    let current = await page(reader, {}, context);

    items.push(...current.items);

    while (current.hasMore) {
      current = await page(reader, { offset: current.nextOffset }, context);

      items.push(...current.items);
    }

    return items;
  }

  async function allInTransaction(transaction: Tx): Promise<ReadonlyArray<T>> {
    const catalog = await transaction.doc(Catalog, name, null);
    const items: Array<T> = [];

    for (let ordinal = catalog.first; ordinal < catalog.total; ordinal += 1) {
      const value = await readAt(transaction, ordinal);

      if (value !== undefined) {
        items.push(value);
      }
    }

    return items;
  }

  return {
    get,
    read,
    put,
    append,
    remove,
    count,
    countInTransaction,
    totalInTransaction,
    at,
    readAt,
    lastInTransaction,
    page,
    all,
    allInTransaction,
  };
}

export function actorRecordCollection<T>(name: string, schema: Schema.Codec<T, unknown>) {
  return createCollection({ name, schema, removal: 'retain_order' });
}

export function actorRecordSet(name: string) {
  return createCollection({ name, schema: Schema.String, removal: 'dense' });
}
