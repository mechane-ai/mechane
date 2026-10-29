import { finishedProcess, StepSubject } from '@mechane/program';
import type { ProcessFailed } from '@mechane/program';
import { releaseBinaryKey, ReleaseStamp } from '@mechane/protocol';
import type { CliTarget, Release, ReleaseManifest } from '@mechane/protocol';
import { Duration, Effect, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLI_ENTRY, ReleaseStep } from '../constants.ts';
import { ReleaseFailed } from '../errors.ts';

/** The prefix of a Bun compile target, such as `bun-linux-x64`. */
const BUN_TARGET_PREFIX = 'bun-';

/** How long Bun may take to compile one binary; the first compile for a target downloads that target's runtime. */
const COMPILE_TIMEOUT = Duration.minutes(3);

/** The maintained license notices that travel inside every standalone CLI binary. */
const LICENSES_FOLDER = join(import.meta.dirname, '../../../../../licenses');

/** The shared compile arguments; each build adds its output path, target and release stamp. */
const COMPILE_ARGUMENTS = ['build', CLI_ENTRY, '--compile', `--asset=${LICENSES_FOLDER}`, '--outfile'] as const;

type CompileBinaryInput = {
  readonly release: Release;
  readonly target: CliTarget;
  readonly folder: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** A target and its binary, as the release's manifest names them. */
type ManifestEntry = readonly [CliTarget, ReleaseManifest['binaries'][string]];

/**
 * Compiles the CLI for one target with Bun into its key below the release's folder, stamped through Bun's define with
 * the release and the target. It answers with the manifest's entry for the binary.
 */
export const compileBinary = Effect.fn('compileBinary')(function* ({
  release,
  target,
  folder,
  inherited,
}: CompileBinaryInput): Effect.fn.Return<ManifestEntry, ReleaseFailed> {
  const path = releaseBinaryKey({ release, target });
  const outfile = join(folder, path);
  const args = [...COMPILE_ARGUMENTS, outfile, `--target=${BUN_TARGET_PREFIX}${target}`];
  const stamp = Schema.encodeSync(Schema.fromJsonString(ReleaseStamp))({ release, target });
  const subjects = [StepSubject.cases.Release.make({ release }), StepSubject.cases.Target.make({ target })];
  const binarySubjects = [StepSubject.cases.Path.make({ path: outfile })];

  const compileFailed: (failure: ProcessFailed) => ReleaseFailed = ({ reason }) =>
    new ReleaseFailed({ step: ReleaseStep.Compile, subjects, reason });

  yield* finishedProcess({
    command: 'bun',
    args: [...args, '--define', `import.meta.mechaneStamp=${stamp}`],
    environment: inherited,
    timeout: COMPILE_TIMEOUT,
  }).pipe(Effect.mapError(compileFailed));

  const bytes = yield* Effect.tryPromise({
    try: () => readFile(outfile),
    catch: (cause) =>
      new ReleaseFailed({ step: ReleaseStep.ReadBinary, subjects: binarySubjects, reason: String(cause) }),
  });

  const sha256 = createHash('sha256').update(bytes).digest('hex');

  return [target, { path, sha256, bytes: bytes.byteLength }];
});
