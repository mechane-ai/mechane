import type { CliTarget } from '@mechane/protocol';
import type { ReleaseFailed } from '@mechane/release';
import { buildRelease, hostTarget } from '@mechane/release';
import type { Stack } from '@mechane/stack';
import { freshFolder } from '@mechane/testing';
import type { FileStepFailed } from '@mechane/testing';
import { Effect, Option, Record } from 'effect';
import { join } from 'node:path';
import { ScenarioFolder } from './constants.ts';
import type { HostRelease, HostReleases } from './types.ts';

/** The two releases the scenario builds: the one install.sh installs, and the later one the update installs. */
const SmokeRelease = { Installed: '0.0.1-smoke', Published: '0.0.2-smoke' } as const;

type HostReleasesInput = { readonly stack: Stack };

type HostReleaseInput = {
  readonly stack: Stack;
  readonly folder: string;
  readonly target: CliTarget;
  readonly release: string;
};

/**
 * Creates the scenario's folder in the stack's state folder, and builds both of its releases for this machine alone, at
 * once, each into a folder there named for it.
 */
export const hostReleases = Effect.fn('hostReleases')(function* ({
  stack,
}: HostReleasesInput): Effect.fn.Return<HostReleases, FileStepFailed | ReleaseFailed> {
  const folder = yield* freshFolder({ stack, prefix: ScenarioFolder.Prefix });
  const target = yield* hostTarget();

  const [installed, published] = yield* Effect.all(
    [
      hostRelease({ stack, folder, target, release: SmokeRelease.Installed }),
      hostRelease({ stack, folder, target, release: SmokeRelease.Published }),
    ],
    { concurrency: 'unbounded' },
  );

  return { folder, installed, published };
});

/** One release built for this machine: its folder, its manifest, and its one binary, which that manifest names. */
const hostRelease = Effect.fn('hostRelease')(function* ({
  stack,
  folder,
  target,
  release,
}: HostReleaseInput): Effect.fn.Return<HostRelease, ReleaseFailed> {
  const releaseFolder = join(folder, release);
  const { workerRevision: revision, settings } = stack;

  const { manifest } = yield* buildRelease({
    release,
    revision,
    targets: [target],
    folder: releaseFolder,
    inherited: settings.inherited,
  });

  // The release is built for this target alone, so its manifest names that binary.
  return { folder: releaseFolder, manifest, binary: Option.getOrThrow(Record.get(manifest.binaries, target)) };
});
