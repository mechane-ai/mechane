import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { SHA256_PATTERN } from '@mechane/records';
import { RELEASE } from '@mechane/releases';
import { Effect, Option, Record, Schema } from 'effect';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DistributionMode, DistributionStep } from './constants.ts';
import { DistributionFailed } from './errors.ts';
import type { DistributionSettings } from './types.ts';

const INHERITED_NAMES = [
  'PATH',
  'HOME',
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'BUILDX_BUILDER',
  'XDG_CACHE_HOME',
  'MISE_CONFIG_DIR',
  'MISE_SYSTEM_CONFIG_DIR',
  'MISE_IGNORED_CONFIG_PATHS',
  'MISE_TRUSTED_CONFIG_PATHS',
] as const;

const OUTPUT_URL: Readonly<URL> = new URL('../../../../dist/distribution', import.meta.url);
const OUTPUT_FOLDER = fileURLToPath(OUTPUT_URL);

const ARGUMENT_MODES: ReadonlySet<DistributionMode> = new Set([
  DistributionMode.Accept,
  DistributionMode.AcceptShard,
  DistributionMode.MergeQualification,
  DistributionMode.VerifyQualified,
]);

const SHARD_TARGET_MODES: ReadonlySet<DistributionMode> = new Set([
  DistributionMode.AcceptShard,
  DistributionMode.MergeQualification,
]);

const DEFAULT_FOLDER_MODES: ReadonlySet<DistributionMode> = new Set([
  DistributionMode.Build,
  DistributionMode.Candidate,
]);

const REUSE_MODES: ReadonlySet<DistributionMode> = new Set([DistributionMode.Build, DistributionMode.Candidate]);

const USAGE_MESSAGE =
  'use candidate [OUTPUT], accept OUTPUT ARTIFACTS_SHA256, accept-shard OUTPUT ARTIFACTS_SHA256 SHARD, merge-qualification OUTPUT ARTIFACTS_SHA256 SHARDS_DIR, build [OUTPUT], verify OUTPUT, preview-module OUTPUT, or verify-qualified OUTPUT SHA256';

/** The staging folder provided by the guest bundler contains one module graph for each output file. */
export function guestNoticesDirectory(): string {
  return Schema.decodeUnknownSync(Schema.NonEmptyString)(process.argv[PROGRAM_ARGUMENTS_START]);
}

/** Reads the distribution command and its allowed child-process environment once. */
export const loadDistributionSettings = Effect.fn('loadDistributionSettings')(function* (): Effect.fn.Return<
  DistributionSettings,
  DistributionFailed
> {
  const [modeText, destination, argument, fourthArgument, fifthArgument, ...extra] =
    process.argv.slice(PROGRAM_ARGUMENTS_START);

  const modeSchema = Schema.Enum(DistributionMode);

  const mode = yield* Schema.decodeUnknownEffect(modeSchema)(modeText).pipe(
    Effect.mapError(() => new DistributionFailed({ step: DistributionStep.Settings, reason: USAGE_MESSAGE })),
  );

  const selectedFolder = Option.fromNullishOr(destination);
  const isMissingFolder = Option.isNone(selectedFolder);
  const needsArgument = ARGUMENT_MODES.has(mode);
  const needsShardTarget = SHARD_TARGET_MODES.has(mode);
  const permitsDefaultFolder = DEFAULT_FOLDER_MODES.has(mode);
  const isMissingRequiredFolder = !permitsDefaultFolder && isMissingFolder;
  const isReuse = REUSE_MODES.has(mode) && argument === '--reuse-guest';

  const hasExtraArguments: boolean = (() => {
    if (needsShardTarget) {
      return fifthArgument !== undefined || extra.length > 0;
    }

    return fourthArgument !== undefined || fifthArgument !== undefined || extra.length > 0;
  })();

  const hasWrongPrimaryArgument = needsArgument !== (argument !== undefined);
  const hasWrongShardTarget = needsShardTarget !== (fourthArgument !== undefined);
  const hasArgumentMismatch = hasExtraArguments || hasWrongPrimaryArgument || hasWrongShardTarget;
  const hasWrongArguments = !isReuse && hasArgumentMismatch;

  if (isMissingRequiredFolder || hasWrongArguments) {
    return yield* new DistributionFailed({ step: DistributionStep.Settings, reason: USAGE_MESSAGE });
  }

  const defaultFolder = resolve(OUTPUT_FOLDER, `v${RELEASE}`);
  const folder = Option.getOrElse(selectedFolder, () => defaultFolder);

  const variableEntries: (name: string) => ReadonlyArray<readonly [string, string]> = (name) => {
    const variable = Option.fromNullishOr(process.env[name]);
    const values = Option.toArray(variable);

    return values.map((value) => [name, value] as const);
  };

  const entries = INHERITED_NAMES.flatMap(variableEntries);

  if (isReuse) {
    if (destination === undefined || fourthArgument === undefined || fifthArgument === undefined) {
      return yield* new DistributionFailed({
        step: DistributionStep.Settings,
        reason: 'select a previous qualified guest folder and SHA-256',
      });
    }

    if (extra.length > 0) {
      return yield* new DistributionFailed({
        step: DistributionStep.Settings,
        reason: 'guest reuse accepts one folder and qualification digest',
      });
    }

    if (!SHA256_PATTERN.test(fifthArgument)) {
      return yield* new DistributionFailed({
        step: DistributionStep.Settings,
        reason: 'select an exact qualification SHA-256',
      });
    }

    return {
      mode,
      folder: resolve(folder),
      inherited: Record.fromEntries(entries),
      nodeExecutable: process.execPath,
      reuseGuest: Option.some({ folder: resolve(fourthArgument), qualificationSha256: fifthArgument }),
    };
  }

  if (needsArgument && !SHA256_PATTERN.test(argument ?? '')) {
    return yield* new DistributionFailed({ step: DistributionStep.Settings, reason: 'select an exact SHA-256 digest' });
  }

  return {
    mode,
    folder: resolve(folder),
    inherited: Record.fromEntries(entries),
    nodeExecutable: process.execPath,
    argument,
    shardTarget: fourthArgument,
    reuseGuest: Option.none(),
  };
});
