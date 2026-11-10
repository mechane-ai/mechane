import { HistoryImportFailed } from './errors.ts';

type HistoryPage<Row> = { readonly items: ReadonlyArray<Row>; readonly hasMore: boolean };

type HistoryPagesInput<Row, Cursor> = {
  readonly initialCursor: Cursor;
  readonly read: (cursor: Cursor) => Promise<HistoryPage<Row>>;
  readonly cursorOf: (row: Row) => Cursor;
};

export async function* historyPages<Row, Cursor>({
  initialCursor,
  read,
  cursorOf,
}: HistoryPagesInput<Row, Cursor>): AsyncGenerator<Row> {
  const state = { cursor: initialCursor, hasMore: true };

  while (state.hasMore) {
    const page = await read(state.cursor);

    yield* page.items;

    state.hasMore = page.hasMore;

    if (!state.hasMore) {
      return;
    }

    const last = page.items.at(-1);

    if (last === undefined) {
      throw new HistoryImportFailed({ reason: 'A preserved-history page has no continuation cursor' });
    }

    const next = cursorOf(last);

    if (next === state.cursor) {
      throw new HistoryImportFailed({ reason: 'A preserved-history page did not advance its cursor' });
    }

    state.cursor = next;
  }
}
