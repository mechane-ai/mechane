import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { EvalFileStep } from '../constants.ts';
import { EvalFileFailed, OutFolderBusy } from '../errors.ts';
import { RECORD_FOLDER_MODE, WRITER_FILE } from './constants.ts';

type HoldApplicationStoreInput = { readonly outFolder: string };

export const holdApplicationStore = Effect.fn('holdApplicationStore')(function* ({
  outFolder,
}: HoldApplicationStoreInput): Effect.fn.Return<void, EvalFileFailed | OutFolderBusy, Scope.Scope> {
  yield* Effect.tryPromise({
    try: () => mkdir(outFolder, { recursive: true, mode: RECORD_FOLDER_MODE }),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.CreateFolder, path: outFolder, reason: String(cause) }),
  });

  const path = join(outFolder, WRITER_FILE);

  const openDatabase = Effect.try({
    try: () => new DatabaseSync(path),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path, reason: String(cause) }),
  });

  const database = yield* Effect.acquireRelease(openDatabase, (opened) => Effect.sync(() => opened.close()));

  // The kernel releases SQLite's writer lock after a crash; recovery never removes another process's lock.
  yield* Effect.try({ try: () => database.exec('BEGIN EXCLUSIVE'), catch: () => new OutFolderBusy({ path }) });
});
