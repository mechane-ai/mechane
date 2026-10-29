import { Option, Schema } from 'effect';
import { decodeFirst } from './decode-first.ts';
import { decodeRows } from './decode-rows.ts';
import type { PageAfterInput, RowsPage, StatementCursor } from './types.ts';

/** The id of the record a reader has last, which a page's rows follow. */
type LastInput = { readonly last: string };

/** Where a page's rows start, after the `rowid` of the row a reader has last, and how many of them to read at most. */
type RowsAfterInput = { readonly rowid: number; readonly count: number };

/**
 * A page of a list that grows, after its cursor, read by the list's own statements: the row a reader has last, and the
 * rows after it.
 */
type ReadPageInput<S> = PageAfterInput & {
  /** Selects the `rowid` of the list's row with the id, none when the list holds no such row. */
  readonly lastRow: (input: LastInput) => StatementCursor;
  /** Selects the list's rows after the `rowid`, in `rowid` order, at most `count` of them. */
  readonly rowsAfter: (input: RowsAfterInput) => StatementCursor;
  readonly schema: S;
};

/**
 * The most records one page of a list that grows holds. Every page says whether more follow, so no client reads it, and
 * a later deployment may change it.
 */
const RECORDS_PER_PAGE = 100;

/** The `rowid` of one row, the order in which its table recorded it. */
const RowidRow = Schema.Struct({ rowid: Schema.Int });

type RowidRow = typeof RowidRow.Type;

/**
 * One page of a list that grows: the rows after the one a reader has last, in the order its table recorded them, and
 * whether more follow. A read of one row past the page tells that, and none answers an id of no row of the list.
 */
export function readPage<S extends Schema.Codec<unknown, unknown>>({
  after,
  lastRow,
  rowsAfter,
  schema,
}: ReadPageInput<S>): Option.Option<RowsPage<S['Type']>> {
  const start: Option.Option<number> = (() => {
    if (Option.isNone(after)) {
      return Option.some(0);
    }

    const last = decodeFirst({ cursor: lastRow({ last: after.value }), schema: RowidRow });

    return Option.map(last, ({ rowid }) => rowid);
  })();

  if (Option.isNone(start)) {
    return Option.none();
  }

  const rows = decodeRows({ cursor: rowsAfter({ rowid: start.value, count: RECORDS_PER_PAGE + 1 }), schema });

  return Option.some({ rows: rows.slice(0, RECORDS_PER_PAGE), hasMore: rows.length > RECORDS_PER_PAGE });
}
