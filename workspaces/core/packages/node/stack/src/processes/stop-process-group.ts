import { Duration, Effect } from 'effect';
import type { ChildInput } from '../types.ts';
import { processExit } from './process-exit.ts';
import { signalGroup } from './signal-group.ts';

/** How long celld may take to exit after SIGTERM before the stack kills its process group. */
const SHUTDOWN_GRACE = Duration.seconds(40);

type StopProcessGroupInput = ChildInput & { readonly kill: Effect.Effect<void> };

/** Stops a process group with SIGTERM, and with SIGKILL when it outlives the grace period. */
export const stopProcessGroup = Effect.fn('stopProcessGroup')(function* ({
  child,
  kill,
}: StopProcessGroupInput): Effect.fn.Return<void> {
  signalGroup({ child, signal: 'SIGTERM' });
  yield* processExit({ child }).pipe(Effect.timeoutOrElse({ duration: SHUTDOWN_GRACE, orElse: () => kill }));
});
