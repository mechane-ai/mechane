import { JSON_INDENT_CHARS } from '@mechane/program';
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

type WriteInput = { readonly path: string; readonly document: unknown };

/** Creates metadata without replacing an existing file from an earlier build. */
export const writeDocument = Effect.fn('writeDocument')(function* ({
  path,
  document,
}: WriteInput): Effect.fn.Return<void, DistributionFailed> {
  const text = `${JSON.stringify(document, undefined, JSON_INDENT_CHARS)}\n`;

  yield* Effect.tryPromise({
    try: () => writeFile(path, text, { flag: 'wx' }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});
