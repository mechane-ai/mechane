import { JSON_INDENT_CHARS } from '@mechane/program';
import { Array, Effect, Order, Record } from 'effect';
import type { FileUnwritable } from '../errors.ts';
import type { SiteCounts } from '../types.ts';
import { writeTextFile } from '../write-text-file.ts';

type WriteBaselineInput = { readonly path: string; readonly counts: SiteCounts };

/** Writes a baseline to `path` as JSON with one file a line, sorted by path, so a merge of two sides lines up. */
export const writeBaseline = Effect.fn('writeBaseline')(function* ({
  path,
  counts,
}: WriteBaselineInput): Effect.fn.Return<void, FileUnwritable> {
  const sorted = Record.fromEntries(Array.sortWith(Record.toEntries(counts), ([file]) => file, Order.String));
  const text = `${JSON.stringify(sorted, null, JSON_INDENT_CHARS)}\n`;

  yield* writeTextFile({ path, text });
});
