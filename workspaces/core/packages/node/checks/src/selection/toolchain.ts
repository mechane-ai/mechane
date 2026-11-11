import { InputUnreadable } from '@mechane/checks-kernel';
import type { InheritedInput } from '@mechane/checks-kernel';
import { sha256Hex } from '@mechane/program';
import { Effect, Option, Record } from 'effect';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { delimiter, isAbsolute, join } from 'node:path';

type Toolchain = { readonly source: string; readonly infrastructure: string };
type ToolInput = InheritedInput & { readonly name: string };

const SOURCE_TOOLS = ['node', 'bun', 'celld'] as const;
const INFRASTRUCTURE_TOOLS = ['node', 'bun', 'go', 'tofu'] as const;

const QUALIFICATION_VARIABLES: ReadonlySet<string> = new Set([
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_CONFIG',
  'CONTAINER_HOST',
  'CELLD_CONTAINER_HOST_SERVICES',
  'MECHANE_NODE_EXECUTABLE',
  'NODE_OPTIONS',
]);

/** Equivalent mise wrappers resolve the same tool bytes despite differing PATH and shell bookkeeping. */
export const toolchain = Effect.fn('toolchain')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<Toolchain, InputUnreadable> {
  const names = [...new Set([...SOURCE_TOOLS, ...INFRASTRUCTURE_TOOLS])];
  const tools = yield* Effect.forEach(names, (name) => toolHash({ name, inherited }), { concurrency: 1 });
  const entries = names.map((name, index) => [name, tools[index]] as const);
  const source = entries.filter(([name]) => SOURCE_TOOLS.some((tool) => tool === name));
  const infrastructure = entries.filter(([name]) => INFRASTRUCTURE_TOOLS.some((tool) => tool === name));
  const configured = Record.get(inherited, 'MECHANE_NODE_EXECUTABLE');
  const configuredNames = Option.toArray(configured);

  const configuredNode = yield* Effect.forEach(configuredNames, (name) => toolHash({ name, inherited }), {
    concurrency: 1,
  });

  const sourceContents = JSON.stringify({ tools: source, configuredNode });
  const infrastructureContents = JSON.stringify(infrastructure);

  return {
    source: sha256Hex({ contents: sourceContents }),
    infrastructure: sha256Hex({ contents: infrastructureContents }),
  };
});

export function qualificationEnvironment({ inherited }: InheritedInput): string {
  const entries = Record.toEntries(inherited)
    .filter(([name]) => QUALIFICATION_VARIABLES.has(name))
    .toSorted(([left], [right]) => left.localeCompare(right));

  const contents = JSON.stringify(entries);

  return sha256Hex({ contents });
}

const toolHash = Effect.fn('toolHash')(function* ({
  name,
  inherited,
}: ToolInput): Effect.fn.Return<string, InputUnreadable> {
  const search = Record.get(inherited, 'PATH');
  const folders = Option.getOrElse(search, () => '').split(delimiter);

  const candidates: ReadonlyArray<string> = (() => {
    if (isAbsolute(name)) {
      return [name];
    }

    return folders.map((folder) => join(folder, name));
  })();

  const found = candidates.find((candidate) => existsSync(candidate));
  const path = Option.fromNullishOr(found);

  if (Option.isNone(path)) {
    return yield* new InputUnreadable({ path: name, reason: 'the pinned executable is absent from PATH' });
  }

  const contents = yield* Effect.tryPromise({
    try: () => readFile(path.value),
    catch: (cause) => new InputUnreadable({ path: path.value, reason: String(cause) }),
  });

  return sha256Hex({ contents });
});
