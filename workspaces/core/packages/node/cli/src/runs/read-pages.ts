import type { PageCursor } from '@mechane/cli-kernel';
import { Array, Effect, Option, Record, Stream } from 'effect';

/** A record of a list that grows, which the next page of the list reads after by its id. */
type ListedRecord = { readonly id: unknown };

/** A list's records under its key, such as `keys` for a principal's keys. */
type PagedList<Key extends string, Item> = Readonly<Record<Key, ReadonlyArray<Item>>>;

/** One page of a list: its records under the list's key, and whether more follow them. */
type ListPage<Key extends string, Item> = PagedList<Key, Item> & { readonly hasMore: boolean };

/** The key a list's page holds its records under, and the read of the page after a cursor. */
type ReadPagesInput<Key extends string, Item extends ListedRecord, E> = {
  readonly key: Key;
  readonly read: (input: PageCursor<Item['id']>) => Effect.Effect<ListPage<Key, Item>, E>;
};

/** A page to read after the cursor `after`, and how to read it. */
type ListedPageInput<Key extends string, Item extends ListedRecord, E> = ReadPagesInput<Key, Item, E> &
  PageCursor<Item['id']>;

/** A page's records, and the cursor after them, none once no more follow. */
type ListedPage<Item extends ListedRecord> = readonly [ReadonlyArray<Item>, Option.Option<Option.Option<Item['id']>>];

/**
 * Reads a list that grows a page at a time from its start, each after the last record of the one before, until a page
 * says no more follow. It answers every record under the list's key, oldest first.
 */
export const readPages = Effect.fn('readPages')(function* <const Key extends string, Item extends ListedRecord, E>({
  key,
  read,
}: ReadPagesInput<Key, Item, E>): Effect.fn.Return<PagedList<Key, Item>, E> {
  const page: (after: Option.Option<Item['id']>) => Effect.Effect<ListedPage<Item>, E> = (after) =>
    listedPage({ key, read, after });

  const items = yield* Stream.runCollect(Stream.paginate(Option.none<Item['id']>(), page));

  return Record.singleton(key, items);
});

/** A page's records after `after`, and the cursor after its last record, or after `after` for an empty page. */
const listedPage = Effect.fn('listedPage')(function* <Key extends string, Item extends ListedRecord, E>({
  key,
  read,
  after,
}: ListedPageInput<Key, Item, E>): Effect.fn.Return<ListedPage<Item>, E> {
  const page = yield* read({ after });
  const items = page[key];

  const next = Option.orElse(
    Option.map(Array.last(items), ({ id }) => id),
    () => after,
  );

  return [items, Option.liftPredicate(next, () => page.hasMore)];
});
