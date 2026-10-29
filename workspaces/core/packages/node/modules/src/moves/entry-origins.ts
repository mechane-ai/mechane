import { Array, Option } from 'effect';
import { originKey } from '../origin-key.ts';
import { exportOrigin } from '../statements/export-origin.ts';
import type { ExportTable } from '../types.ts';

type EntryOriginsInput = { readonly entry: string; readonly table: ExportTable };

/** The keys of the declarations an entry exports. */
export function entryOrigins({ entry, table }: EntryOriginsInput): ReadonlyArray<string> {
  const exports = Option.fromNullishOr(table.get(entry));

  if (Option.isNone(exports)) {
    return [];
  }

  const exported = [...exports.value.keys()];
  const origins = Array.getSomes(exported.map((name) => exportOrigin({ table, path: entry, name })));

  return origins.map((origin) => originKey(origin));
}
