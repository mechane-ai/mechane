import { decodeFile } from '@mechane/checks-kernel';
import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import { PROGRAM_FILE } from '@mechane/modules';
import { Array, Effect, Option, Record, Schema } from 'effect';
import { basename, dirname, join } from 'node:path';
import { BundleTarget } from './constants.ts';
import type { BundleEntry } from './types.ts';

/** The Wrangler configuration of an app, which names its Worker module. */
const WORKER_CONFIGURATION = 'wrangler.jsonc';

/** The part of an app's Wrangler configuration that names its Worker module, relative to the configuration. */
const WranglerMain = Schema.Struct({ main: Schema.String });

type WranglerMain = typeof WranglerMain.Type;

/** How an artifact builds: the runtime its bundle targets, and the modules the bundle leaves out. */
type BundleBuild = { readonly target: BundleTarget; readonly externals: ReadonlyArray<string> };

type BundleEntriesInput = { readonly files: ReadonlyArray<string>; readonly members: ReadonlyArray<Member> };

type RoleBundleInput = { readonly entry: string; readonly installed: ReadonlyArray<string> };

/**
 * Shipped programs build whole for their runtime. Other programs run on Node against installed packages, which the
 * lockfile pins, so their fingerprint bundles leave those dependencies out.
 */
const SHIPPED_BUNDLES: Readonly<Record<string, BundleBuild>> = {
  'packages/node/guest/src/main.ts': { target: BundleTarget.Node, externals: [] },
  'packages/node/cli/src/main.ts': { target: BundleTarget.Bun, externals: [] },
};

/** The bundles the fingerprint builds: each app's Worker module and every program's `main.ts`, each keyed by role. */
export const bundleEntries = Effect.fn('bundleEntries')(function* ({
  files,
  members,
}: BundleEntriesInput): Effect.fn.Return<ReadonlyArray<BundleEntry>, InputUnreadable> {
  const installed = [...new Set(members.flatMap((member) => member.external))].toSorted();

  /** Whether the file is an app's Wrangler configuration. */
  const isConfiguration: (file: string) => boolean = (file) => basename(file) === WORKER_CONFIGURATION;
  const configurations = files.filter(isConfiguration);

  const mains = yield* Effect.forEach(configurations, (path) => decodeFile({ path, schema: WranglerMain }), {
    concurrency: 1,
  });

  /** Workers retain browser resolution while their runtime supplies platform modules. */
  const workerBundle: (configured: readonly [string, WranglerMain]) => BundleEntry = ([path, { main }]) => {
    const entry = join(dirname(path), main);

    return { role: entry, entry, target: BundleTarget.Browser, externals: ['cloudflare:*', 'node:*'] };
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
    .map((entry) => roleBundle({ entry, installed }));

  return [...configuredWorkers.map(workerBundle), ...programs];
});

/** A role's bundle: a shipped artifact's own build, or a Node build that leaves the installed packages out. */
function roleBundle({ entry, installed }: RoleBundleInput): BundleEntry {
  const shipped = Option.getOrElse(Record.get(SHIPPED_BUNDLES, entry), () => ({
    target: BundleTarget.Node,
    externals: installed,
  }));

  return { role: entry, entry, ...shipped };
}
