import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { SHA256_PATTERN } from '@mechane/records';
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
  DistributionMode.VerifyQualified,
]);

const DEFAULT_FOLDER_MODES: ReadonlySet<DistributionMode> = new Set([
  DistributionMode.Build,
  DistributionMode.Candidate,
]);

const REUSE_MODES: ReadonlySet<DistributionMode> = new Set([DistributionMode.Build, DistributionMode.Candidate]);

/** Reads the distribution command and its allowed child-process environment once. */
export const loadDistributionSettings = Effect.fn('loadDistributionSettings')(function* (): Effect.fn.Return<
  DistributionSettings,
  DistributionFailed
> {
  const [modeText, destination, argument, previousFolder, previousDigest, ...extra] =
    process.argv.slice(PROGRAM_ARGUMENTS_START);

  const modeSchema = Schema.Enum(DistributionMode);

  const mode = yield* Schema.decodeUnknownEffect(modeSchema)(modeText).pipe(
    Effect.mapError(
      () =>
        new DistributionFailed({
          step: DistributionStep.Settings,
          reason: 'use candidate, accept, build, verify, preview-module, or verify-qualified',
        }),
    ),
  );

  const selectedFolder = Option.fromNullishOr(destination);
  const isMissingFolder = Option.isNone(selectedFolder);

  const needsArgument = ARGUMENT_MODES.has(mode);
  const permitsDefaultFolder = DEFAULT_FOLDER_MODES.has(mode);
  const isMissingRequiredFolder = !permitsDefaultFolder && isMissingFolder;

  const isReuse = REUSE_MODES.has(mode) && argument === '--reuse-guest';

  const hasExtraArguments = previousFolder !== undefined || previousDigest !== undefined || extra.length > 0;
  const hasWrongArguments = !isReuse && (hasExtraArguments || needsArgument !== (argument !== undefined));

  if (isMissingRequiredFolder || hasWrongArguments) {
    return yield* new DistributionFailed({
      step: DistributionStep.Settings,
      reason:
        'use candidate [OUTPUT], accept OUTPUT ARTIFACTS_SHA256, build [OUTPUT], verify OUTPUT, preview-module OUTPUT, or verify-qualified OUTPUT SHA256',
    });
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
    if (destination === undefined || previousFolder === undefined || previousDigest === undefined) {
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

    if (!SHA256_PATTERN.test(previousDigest)) {
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
      reuseGuest: Option.some({ folder: resolve(previousFolder), qualificationSha256: previousDigest }),
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
    reuseGuest: Option.none(),
  };
});
