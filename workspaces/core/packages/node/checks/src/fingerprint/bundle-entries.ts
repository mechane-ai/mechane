import { decodeFile } from '@mechane/checks-kernel';
import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import { PROGRAM_FILE } from '@mechane/modules';
import { Array, Effect, Option, Record, Schema } from 'effect';
import { basename, dirname, join } from 'node:path';
import { BundleTarget } from './constants.ts';
import type { BundleEntry } from './types.ts';

/** The role of the Worker module, which each app's Wrangler configuration names as its `main`. */
const WORKER_ROLE = 'worker';

/** The Wrangler configuration of an app, which names its Worker module. */
const WORKER_CONFIGURATION = 'wrangler.jsonc';

/** The folder of a member's own source; a program there takes the member's folder name as its role. */
const SOURCE_FOLDER = 'src';

/** The part of an app's Wrangler configuration that names its Worker module, relative to the configuration. */
const WranglerMain = Schema.Struct({ main: Schema.String });

type WranglerMain = typeof WranglerMain.Type;

/** How an artifact builds: the runtime its bundle targets, and the modules the bundle leaves out. */
type BundleBuild = { readonly target: BundleTarget; readonly externals: ReadonlyArray<string> };

type BundleEntriesInput = { readonly files: ReadonlyArray<string>; readonly members: ReadonlyArray<Member> };

type RoleBundleInput = { readonly role: string; readonly entry: string; readonly installed: ReadonlyArray<string> };

/**
 * The artifacts that ship as one bundle each, built whole for the runtime that runs them. Every other program runs on
 * Node against the installed packages, which the lockfile pins, so its bundle leaves them out. Workers retain browser
 * dependency resolution while `nodejs_compat` supplies their `node:*` imports at runtime.
 */
const SHIPPED_BUNDLES: Readonly<Record<string, BundleBuild>> = {
  worker: { target: BundleTarget.Browser, externals: ['cloudflare:*', 'node:*'] },
  guest: { target: BundleTarget.Node, externals: [] },
  cli: { target: BundleTarget.Bun, externals: [] },
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

  /** The Worker module an app's configuration names, as a bundle. */
  const workerBundle: (configured: readonly [string, WranglerMain]) => BundleEntry = ([path, { main }]) =>
    roleBundle({ role: WORKER_ROLE, entry: join(dirname(path), main), installed });

  /** A program's role is its folder's name, or its member's folder name when it is the member's `src/main.ts`. */
  const programBundle: (entry: string) => BundleEntry = (entry) => {
    const folder = dirname(entry);

    if (basename(folder) === SOURCE_FOLDER) {
      return roleBundle({ role: basename(dirname(folder)), entry, installed });
    }

    return roleBundle({ role: basename(folder), entry, installed });
  };

  /** Whether the file is a program's entry. */
  const isProgram: (file: string) => boolean = (file) => basename(file) === PROGRAM_FILE;
  const programs = files.filter(isProgram).map(programBundle);

  return [...Array.zip(configurations, mains).map(workerBundle), ...programs];
});

/** A role's bundle: a shipped artifact's own build, or a Node build that leaves the installed packages out. */
function roleBundle({ role, entry, installed }: RoleBundleInput): BundleEntry {
  const shipped = Option.getOrElse(Record.get(SHIPPED_BUNDLES, role), () => ({
    target: BundleTarget.Node,
    externals: installed,
  }));

  return { role, entry, ...shipped };
}
