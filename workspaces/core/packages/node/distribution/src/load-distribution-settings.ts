import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { Effect, Option, Record, Schema } from 'effect';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DistributionMode, DistributionStep } from './constants.ts';
import { DistributionFailed } from './errors.ts';
import type { DistributionSettings } from './types.ts';

const INHERITED_NAMES = ['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'BUILDX_BUILDER', 'XDG_CACHE_HOME'] as const;
const OUTPUT_URL: Readonly<URL> = new URL('../../../../dist/distribution', import.meta.url);
const OUTPUT_FOLDER = fileURLToPath(OUTPUT_URL);

/** Reads the distribution command and its allowed child-process environment once. */
export const loadDistributionSettings = Effect.fn('loadDistributionSettings')(function* (): Effect.fn.Return<
  DistributionSettings,
  DistributionFailed
> {
  const [modeText, destination, ...extra] = process.argv.slice(PROGRAM_ARGUMENTS_START);
  const modeSchema = Schema.Enum(DistributionMode);

  const mode = yield* Schema.decodeUnknownEffect(modeSchema)(modeText).pipe(
    Effect.mapError(
      () => new DistributionFailed({ step: DistributionStep.Settings, reason: 'use build or verify OUTPUT' }),
    ),
  );

  const selectedFolder = Option.fromNullishOr(destination);
  const isMissingFolder = Option.isNone(selectedFolder);

  if (extra.length > 0 || (mode !== DistributionMode.Build && isMissingFolder)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Settings,
      reason: 'use build [OUTPUT], verify OUTPUT, or preview-module OUTPUT',
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

  return { mode, folder: resolve(folder), inherited: Record.fromEntries(entries) };
});
