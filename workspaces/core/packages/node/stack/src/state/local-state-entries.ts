import { StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import { readdir } from 'node:fs/promises';
import type { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { LOCAL_FILES } from './constants.ts';

/** The lock files retained during reset so another process cannot acquire a replacement inode. */
const LOCAL_LOCK_FILES: ReadonlySet<string> = new Set([LOCAL_FILES.lock, `${LOCAL_FILES.lock}-journal`]);

type LocalStateEntriesInput = { readonly stateFolder: string; readonly step: StackStep };

/** Lists installation entries other than the lock files that must survive reset. */
export const localStateEntries = Effect.fn('localStateEntries')(function* ({
  stateFolder,
  step,
}: LocalStateEntriesInput): Effect.fn.Return<ReadonlyArray<string>, StackFailed> {
  const subjects = [StepSubject.cases.Path.make({ path: stateFolder })];

  const entries = yield* Effect.tryPromise({
    try: () => readdir(stateFolder),
    catch: (cause) => new StackFailed({ step, subjects, reason: String(cause) }),
  });

  const isStateEntry: (entry: string) => boolean = (entry) => !LOCAL_LOCK_FILES.has(entry);

  return entries.filter(isStateEntry);
});
