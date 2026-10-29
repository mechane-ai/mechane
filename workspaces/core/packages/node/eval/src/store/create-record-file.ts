import { createFile } from '@mechane/program';
import { Effect } from 'effect';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { EvalFileStep } from '../constants.ts';
import { EvalFileFailed } from '../errors.ts';
import { RECORD_MODE } from './constants.ts';

type CreateRecordFileInput = { readonly path: string; readonly text: string };

/** Creates the record file at `path` with the text, in its folder, made when absent; a file that exists fails it. */
export const createRecordFile = Effect.fn('createRecordFile')(function* ({
  path,
  text,
}: CreateRecordFileInput): Effect.fn.Return<void, EvalFileFailed> {
  const folder = dirname(path);

  yield* Effect.tryPromise({
    try: () => mkdir(folder, { recursive: true }),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.CreateFolder, path: folder, reason: String(cause) }),
  });
  yield* createFile({ path, contents: text, mode: RECORD_MODE }).pipe(
    Effect.mapError(({ step, path: failedPath, reason }) => new EvalFileFailed({ step, path: failedPath, reason })),
  );
});
