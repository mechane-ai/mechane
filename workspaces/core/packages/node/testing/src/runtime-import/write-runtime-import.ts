import { PrivateMode } from '@mechane/program';
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { Account } from '../types.ts';

type WriteRuntimeImportInput = { readonly account: Account; readonly document: unknown };

/** Fixture credentials stay in an owner-only file and never enter command arguments. */
export const writeRuntimeImport = Effect.fn('writeRuntimeImport')(function* ({
  account,
  document,
}: WriteRuntimeImportInput): Effect.fn.Return<string, FileStepFailed> {
  const file = join(account.configurationRoot, 'runtime-import.json');
  const text = JSON.stringify(document);

  yield* Effect.tryPromise({
    try: () => writeFile(file, text, { mode: PrivateMode.File }),
    catch: () =>
      new FileStepFailed({ step: FileStep.Write, path: file, reason: 'could not write private import fixture' }),
  });

  return file;
});
