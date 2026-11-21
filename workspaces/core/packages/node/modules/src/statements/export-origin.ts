import { Option } from 'effect';
import type { ExportLink, ExportTable, Origin } from '../types.ts';

type ExportOriginInput = { readonly table: ExportTable; readonly path: string; readonly name: string };

/** The file and name that declare what a file exports under `name`, through each re-export; none when nothing does. */
export function exportOrigin({ table, path, name }: ExportOriginInput): Option.Option<Origin> {
  let link = readExportLink({ table, path, name });

  while (Option.isSome(link) && !link.value.isLocal) {
    link = readExportLink({ table, path: link.value.path, name: link.value.name });
  }

  return Option.map(link, ({ path: originPath, name: originName }) => ({ path: originPath, name: originName }));
}

function readExportLink({ table, path, name }: ExportOriginInput): Option.Option<ExportLink> {
  const exports = Option.fromNullishOr(table.get(path));

  return Option.flatMapNullishOr(exports, (links) => links.get(name));
}
