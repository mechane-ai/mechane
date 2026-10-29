import { Effect } from 'effect';
import type { ChildInput } from '../types.ts';
import { processExit } from './process-exit.ts';
import { signalGroup } from './signal-group.ts';

/** Kills a process group at once, as a crash would, and waits until its leader has exited. */
export const killProcessGroup = Effect.fn('killProcessGroup')(function* ({
  child,
}: ChildInput): Effect.fn.Return<void> {
  signalGroup({ child, signal: 'SIGKILL' });
  yield* processExit({ child });
});
