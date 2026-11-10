import { decodeFile, InputUnreadable } from '@mechane/checks-kernel';
import type { Member } from '@mechane/checks-kernel';
import { PROGRAM_FILE } from '@mechane/modules';
import { workerBuildOptions } from '@mechane/wrangler';
import { Array, Effect, Option, Record, Schema } from 'effect';
import { basename, dirname, join } from 'node:path';
import { BundleTarget } from './constants.ts';
import type { BundleEntry } from './types.ts';

/** The Wrangler configuration of an app, which names its Worker module. */
const WORKER_CONFIGURATION = 'wrangler.jsonc';

/** The part of an app's Wrangler configuration that names its Worker module, relative to the configuration. */
const WranglerMain = Schema.Struct({ main: Schema.String });

type WranglerMain = typeof WranglerMain.Type;

type BundleBuild = Pick<BundleEntry, 'target' | 'externals' | 'conditions'>;

type BundleEntriesInput = { readonly files: ReadonlyArray<string>; readonly members: ReadonlyArray<Member> };

type RoleBundleInput = {
  readonly entry: string;
  readonly installed: ReadonlyArray<string>;
  readonly shipped: Readonly<Record<string, BundleBuild>>;
};

/** The bundles the fingerprint builds: each app's Worker module and every program's `main.ts`, each keyed by role. */
export const bundleEntries = Effect.fn('bundleEntries')(function* ({
  files,
  members,
}: BundleEntriesInput): Effect.fn.Return<ReadonlyArray<BundleEntry>, InputUnreadable> {
  const installed = [...new Set(members.flatMap((member) => member.external))].toSorted();
  const options = workerBuildOptions();

  if (options.platform !== BundleTarget.Browser) {
    const platform = String(options.platform);

    return yield* new InputUnreadable({
      path: 'the Worker compiler',
      reason: `unsupported fingerprint platform ${platform}`,
    });
  }

  const external = Option.fromNullishOr(options.external);
  const conditions = Option.fromNullishOr(options.conditions);

  const worker: BundleBuild = {
    target: options.platform,
    externals: Option.getOrElse(external, () => []),
    conditions: Option.getOrElse(conditions, () => []),
  };

  /** Shipped roles retain owned dependencies; other Node programs rely on the installed lockfile. */
  const shipped: Readonly<Record<string, BundleBuild>> = {
    'packages/worker/server/src/main.ts': worker,
    'packages/node/guest/src/main.ts': { target: BundleTarget.Node, externals: [], conditions: [] },
    'packages/node/cli/src/main.ts': { target: BundleTarget.Bun, externals: [], conditions: [] },
  };

  /** Whether the file is an app's Wrangler configuration. */
  const isConfiguration: (file: string) => boolean = (file) => basename(file) === WORKER_CONFIGURATION;
  const configurations = files.filter(isConfiguration);

  const mains = yield* Effect.forEach(configurations, (path) => decodeFile({ path, schema: WranglerMain }), {
    concurrency: 1,
  });

  /** Workers retain browser resolution while their runtime supplies platform modules. */
  const workerBundle: (configured: readonly [string, WranglerMain]) => BundleEntry = ([path, { main }]) => {
    const entry = join(dirname(path), main);

    return { role: entry, entry, ...worker };
  };

  /** Whether the file is a program's entry. */
  const isProgram: (file: string) => boolean = (file) => basename(file) === PROGRAM_FILE;
  const configuredWorkers = Array.zip(configurations, mains);

  const paths = configuredWorkers.map(([path, { main }]) => {
    const folder = dirname(path);

    return join(folder, main);
  });

  const workerEntries = new Set(paths);

  const programs = files
    .filter(isProgram)
    .filter((path) => !workerEntries.has(path))
    .map((entry) => roleBundle({ entry, installed, shipped }));

  return [...configuredWorkers.map(workerBundle), ...programs];
});

/** A role's bundle: a shipped artifact's own build, or a Node build that leaves the installed packages out. */
function roleBundle({ entry, installed, shipped }: RoleBundleInput): BundleEntry {
  const build = Option.getOrElse(Record.get(shipped, entry), () => ({
    target: BundleTarget.Node,
    externals: installed,
    conditions: [],
  }));

  return { role: entry, entry, ...build };
}
