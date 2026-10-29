import { Option } from 'effect';
import type { ExportTable, Origin } from '../types.ts';

type ExportOriginInput = { readonly table: ExportTable; readonly path: string; readonly name: string };

/** The file and name that declare what a file exports under `name`, through each re-export; none when nothing does. */
export function exportOrigin({ table, path, name }: ExportOriginInput): Option.Option<Origin> {
  const exports = Option.fromNullishOr(table.get(path));
  const link = Option.flatMapNullishOr(exports, (links) => links.get(name));

  if (Option.isNone(link)) {
    return Option.none();
  }

  if (link.value.isLocal) {
    return Option.some({ path: link.value.path, name: link.value.name });
  }

  return exportOrigin({ table, path: link.value.path, name: link.value.name });
}
