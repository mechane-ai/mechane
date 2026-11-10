import { FACTORY_FOLDER, folderPrefixPath, gitLines, InputUnreadable, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { InheritedInput, Member, ModuleGraph } from '@mechane/checks-kernel';
import { sha256Hex } from '@mechane/program';
import { Array, Effect, Option, Record } from 'effect';
import { globSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, matchesGlob, relative, resolve } from 'node:path';
import type { CheckTarget } from './check-targets.ts';

export type TargetInputsInput = {
  readonly target: CheckTarget;
  readonly files: ReadonlyArray<string>;
  readonly members: ReadonlyArray<Member>;
  readonly graph: ModuleGraph;
};

type DependencyClosureInput = { readonly reached: ReadonlyArray<string>; readonly graph: ModuleGraph };

type DependencyState = { readonly reached: ReadonlyArray<string>; readonly pending: ReadonlyArray<string> };

type DependencyStepInput = { readonly state: DependencyState; readonly graph: ModuleGraph };

type MemberClosureInput = { readonly reached: ReadonlyArray<Member>; readonly members: ReadonlyArray<Member> };

type FileHashesInput = { readonly paths: ReadonlyArray<string> };

type FileHashInput = { readonly path: string };

type ArtifactInputsInput = { readonly target: CheckTarget };

export type TargetArtifacts = { readonly hash: string; readonly isComplete: boolean };

/** The inventory includes names, so adding, removing, or moving an input invalidates its check. */
export const selectionFiles = Effect.fn('selectionFiles')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const paths = yield* gitLines({
    args: ['ls-files', '--cached', '--others', '--exclude-standard', '--full-name', '--', ':/'],
    inherited,
  });

  const deleted = yield* gitLines({ args: ['ls-files', '--deleted', '--full-name', '--', ':/'], inherited });
  const unique = new Set(paths);
  const current = Array.difference(unique, deleted);

  return current
    .map((path) => {
      const absolute = join(FACTORY_FOLDER, path);

      return relative(WORKSPACE_FOLDER, absolute);
    })
    .toSorted();
});

export const targetInputs = Effect.fn('targetInputs')(function* ({
  target,
  files,
  members,
  graph,
}: TargetInputsInput): Effect.fn.Return<string, InputUnreadable> {
  const holders = members.filter(({ folder }) => {
    const prefix = folderPrefixPath({ folder });

    return folder !== '' && target.roots.some((root) => root.startsWith(prefix));
  });

  const closure = memberClosure({ reached: holders, members });
  const dependencies = dependencyClosure({ reached: target.roots, graph });
  const imported = new Set(dependencies);
  const prefixes = closure.map(({ folder }) => folderPrefixPath({ folder }));
  const readmes = closure.map(({ folder }) => join(folder, 'README.md'));
  const documentation = new Set(readmes);

  const paths = files.filter((path) => {
    const isMemberInput = prefixes.some((prefix) => path.startsWith(prefix));
    const isDeclaredInput = target.inputs.some((pattern) => matchesGlob(path, pattern));
    const isOwnedSource = isMemberInput && !documentation.has(path);

    return imported.has(path) || isDeclaredInput || isOwnedSource;
  });

  const hash = yield* fileHashes({ paths });
  const declaration = JSON.stringify(target);

  return sha256Hex({ contents: `${declaration}\n${hash}` });
});

/** Reuse also requires the exact built files still present in this checkout. */
export const targetArtifacts = Effect.fn('targetArtifacts')(function* ({
  target,
}: ArtifactInputsInput): Effect.fn.Return<TargetArtifacts, InputUnreadable> {
  const groups = yield* Effect.try({
    try: () => target.artifacts.map((pattern) => globSync(pattern, { cwd: WORKSPACE_FOLDER, withFileTypes: true })),
    catch: (cause) => new InputUnreadable({ path: target.task, reason: String(cause) }),
  });

  const paths = groups.flatMap((entries) =>
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);

        return relative(WORKSPACE_FOLDER, path);
      }),
  );

  const unique = [...new Set(paths)].toSorted();
  const hash = yield* fileHashes({ paths: unique });
  const isComplete = groups.every((entries) => entries.some((entry) => entry.isFile()));

  return { hash, isComplete };
});

const fileHashes = Effect.fn('fileHashes')(function* ({
  paths,
}: FileHashesInput): Effect.fn.Return<string, InputUnreadable> {
  const hashes = yield* Effect.forEach(paths, (path) => fileHash({ path }), { concurrency: 1 });

  const contents = hashes.toSorted().join('\n');

  return sha256Hex({ contents });
});

const fileHash = Effect.fn('fileHash')(function* ({ path }: FileHashInput): Effect.fn.Return<string, InputUnreadable> {
  const absolute = resolve(WORKSPACE_FOLDER, path);

  const contents = yield* Effect.tryPromise({
    try: () => readFile(absolute),
    catch: (cause) => new InputUnreadable({ path, reason: String(cause) }),
  });

  const hash = sha256Hex({ contents });

  return JSON.stringify([path, hash]);
});

function dependencyClosure({ reached, graph }: DependencyClosureInput): ReadonlyArray<string> {
  let state: DependencyState = { reached: [...new Set(reached)], pending: reached };

  while (state.pending.length > 0) {
    state = dependencyStep({ state, graph });
  }

  return state.reached;
}

function dependencyStep({ state, graph }: DependencyStepInput): DependencyState {
  const imported = state.pending.flatMap((path) => {
    const dependencies = Record.get(graph, path);

    return Option.getOrElse(dependencies, () => []);
  });

  const unique = new Set(imported);
  const pending = Array.difference(unique, state.reached);

  return { reached: [...state.reached, ...pending], pending };
}

function memberClosure({ reached, members }: MemberClosureInput): ReadonlyArray<Member> {
  const entries = members.map(({ name, internal }) => [name, internal] as const);
  const graph = Record.fromEntries(entries);
  const roots = reached.map(({ name }) => name);
  const dependencies = dependencyClosure({ reached: roots, graph });
  const names = new Set(dependencies);

  return members.filter(({ name }) => names.has(name));
}
