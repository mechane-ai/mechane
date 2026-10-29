import { Effect } from 'effect';
import type { ChildInput } from '../types.ts';
import { isProcessExited } from './is-process-exited.ts';

/** Waits until the process has exited, at once when it already has. */
export const processExit = Effect.fn('processExit')(function* ({ child }: ChildInput): Effect.fn.Return<void> {
  yield* Effect.callback<void>((resume) => {
    const exited: () => void = () => resume(Effect.void);

    if (isProcessExited({ child })) {
      exited();

      return;
    }

    child.once('exit', exited);
  });
});
