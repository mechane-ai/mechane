import { Bytes, BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Array, Option } from 'effect';

/** A row as a page's statement reads it: its rowid, then its values. */
type ReadRow = ReadonlyArray<SqlStorageValue>;

/**
 * The bytes of rows that end a page of a copy, as their values' JSON counts them, exact enough for STRICT tables
 * without blobs. A page holds whole rows, at most one past this bound. A row is below SQLite's 2 MB limit, so a page
 * stays far below the 32 MiB an RPC may carry.
 */
const COPY_PAGE_BYTES = BYTES_PER_MEBIBYTE;

/** The rows one statement of a copy read, and the bytes the page held before them. */
type TakenRowsInput = { readonly batch: ReadonlyArray<ReadRow>; readonly pageBytes: Bytes };

/** The rows a page takes of a statement's, the bytes the page holds after them, and whether they filled it. */
type TakenRows = { readonly rows: ReadonlyArray<ReadRow>; readonly pageBytes: Bytes; readonly isFull: boolean };

/** The page's bytes after as many of a statement's rows as the count. */
type PageTotal = readonly [count: number, bytes: number];

/** The rows of one statement a page takes until its bytes reach their bound, the row that reaches it included. */
export function takenRows({ batch, pageBytes }: TakenRowsInput): TakenRows {
  const encoder = new TextEncoder();
  const rowBytes: (row: ReadRow) => number = ([, ...values]) => encoder.encode(JSON.stringify(values)).byteLength;
  const sum: (total: number, bytes: number) => number = (total, bytes) => total + bytes;
  const totals = Array.scan(batch.map(rowBytes), pageBytes, sum);
  const isFilled: (total: PageTotal) => boolean = ([, bytes]) => bytes >= COPY_PAGE_BYTES;

  const takenAll: () => TakenRows = () => ({
    rows: batch,
    pageBytes: Bytes.make(Array.lastNonEmpty(totals)),
    isFull: false,
  });

  const takenTo: (total: PageTotal) => TakenRows = ([count, bytes]) => ({
    rows: batch.slice(0, count),
    pageBytes: Bytes.make(bytes),
    isFull: true,
  });

  return Option.match(Array.findFirst([...totals.entries()], isFilled), { onNone: takenAll, onSome: takenTo });
}
