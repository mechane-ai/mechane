import { writeResult } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../errors.ts';
import { resetLocalState } from '../state/reset-local-state.ts';
import type { StackSettings } from '../types.ts';

type ResetLocalStackInput = { readonly settings: StackSettings };

/** Erases only a recognized, stopped installation after the command explicitly confirms reset. */
export const resetLocalStack = Effect.fn('resetLocalStack')(function* ({
  settings,
}: ResetLocalStackInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  yield* resetLocalState({ path: settings.localStateFolder });
  writeResult({ line: `reset local state at ${settings.localStateFolder}` });
});
