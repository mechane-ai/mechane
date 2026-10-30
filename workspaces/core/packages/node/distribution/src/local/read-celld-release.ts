import { Effect, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { DistributionStep, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { CelldRelease } from './schemas.ts';

const ToolLock = Schema.Struct({ tools: Schema.Struct({ 'github:denoland/celld': Schema.Tuple([CelldRelease]) }) });

/** Reads the same binary checksums that pin the contributor runtime. */
export const readCelldRelease = Effect.fn('readCelldRelease')(function* (): Effect.fn.Return<
  CelldRelease,
  DistributionFailed
> {
  const path = join(SOURCE_FOLDER, 'mise.lock');

  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  const document = yield* Effect.try({
    try: () => parse(text),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  const lock = yield* Schema.decodeUnknownEffect(ToolLock)(document).pipe(
    Effect.mapError(
      () => new DistributionFailed({ step: DistributionStep.Read, reason: 'celld release pins are incomplete' }),
    ),
  );

  return lock.tools['github:denoland/celld'][0];
});
