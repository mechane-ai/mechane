import { parsedText, readText } from '@mechane/checks-kernel';
import type { InputUnreadable, ModuleGraph } from '@mechane/checks-kernel';
import { moduleStatements, NodeType } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Effect, Option, Record } from 'effect';
import { EXPORT_ALL_NODE } from './constants.ts';
import { SMOKE_SOURCE } from './smoke-catalog.ts';

type SmokeDependenciesInput = { readonly files: ReadonlyArray<string>; readonly graph: ModuleGraph };
type SmokeDependencyInput = { readonly path: string; readonly paths: ReadonlyArray<string> };
type RelativeImportInput = { readonly statement: ParsedSource['parsed']['program']['body'][number] };

/** Fresh local smoke edges prevent a standalone family run from trusting an older cruise. */
export const smokeDependencies = Effect.fn('smokeDependencies')(function* ({
  files,
  graph,
}: SmokeDependenciesInput): Effect.fn.Return<ModuleGraph, InputUnreadable> {
  const paths = files.filter((path) => path.startsWith(SMOKE_SOURCE) && path.endsWith('.ts'));

  const entries = yield* Effect.forEach(paths, (path) => smokeDependency({ path, paths }), { concurrency: 1 });

  const current = Record.fromEntries(entries);

  return { ...graph, ...current };
});

const smokeDependency = Effect.fn('smokeDependency')(function* ({
  path,
  paths,
}: SmokeDependencyInput): Effect.fn.Return<readonly [string, ReadonlyArray<string>], InputUnreadable> {
  const text = yield* readText({ path });
  const source = parsedText({ path, text });
  const modules = moduleStatements({ source });
  const targets = modules.flatMap(({ target }) => Option.toArray(target));
  const relatives = source.parsed.program.body.filter((statement) => isRelativeImport({ statement }));

  if (targets.length !== relatives.length || /\bimport\s*\(/u.test(text)) {
    return [path, paths];
  }

  return [path, targets];
});

function isRelativeImport({ statement }: RelativeImportInput): boolean {
  if (statement.type === NodeType.ImportDeclaration) {
    return statement.source.value.startsWith('.');
  }

  if (statement.type === NodeType.ExportNamedDeclaration) {
    const source = Option.fromNullishOr(statement.source);

    return Option.isSome(source) && source.value.value.startsWith('.');
  }

  if (statement.type === EXPORT_ALL_NODE) {
    return statement.source.value.startsWith('.');
  }

  return false;
}
