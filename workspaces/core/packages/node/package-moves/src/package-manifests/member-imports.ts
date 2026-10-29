import { parsedText } from '@mechane/checks-kernel';
import { Array, Option } from 'effect';
import { memberOf } from '../member-of.ts';
import type { RewrittenSource, StepLayout } from '../packages.types.ts';
import { packageName } from './package-name.ts';

/** A step's layout, and every TypeScript file after it. */
type MemberImportsInput = { readonly layout: StepLayout; readonly sources: ReadonlyArray<RewrittenSource> };

/** A step's layout, and one TypeScript file after it. */
type FileImportsInput = { readonly layout: StepLayout; readonly source: RewrittenSource };

/** A package a member's file imports, by the member's folder after the step. */
type MemberImport = { readonly folder: string; readonly name: string };

/** The installed packages each member's files import or re-export from after the step, by the member's folder. */
export function memberImports({ layout, sources }: MemberImportsInput): ReadonlyMap<string, ReadonlySet<string>> {
  const imports = sources.flatMap((source) => fileImports({ layout, source }));

  /** A member's folder, and the packages its files import. */
  const folderImports: (
    group: readonly [string, ReadonlyArray<MemberImport>],
  ) => readonly [string, ReadonlySet<string>] = ([folder, group]) => [folder, new Set(group.map(({ name }) => name))];

  return new Map([...Map.groupBy(imports, ({ folder }) => folder)].map(folderImports));
}

/** The packages one file's static imports and re-exports name, by its member's folder. */
function fileImports({ layout, source }: FileImportsInput): ReadonlyArray<MemberImport> {
  const { module } = parsedText({ path: source.path, text: source.text }).parsed;
  const { folder } = memberOf({ layout, path: source.path });

  const requests = [
    ...module.staticImports.map(({ moduleRequest }) => moduleRequest),
    ...Array.getSomes(
      module.staticExports
        .flatMap(({ entries }) => entries)
        .map(({ moduleRequest }) => Option.fromNullishOr(moduleRequest)),
    ),
  ];

  const names = Array.getSomes(requests.map(({ value }) => packageName({ specifier: value })));

  return names.map((name) => ({ folder, name }));
}
