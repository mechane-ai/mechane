import { Effect } from 'effect';
import type { ArchiveProcess } from './types.ts';

/** Ends tar when its scoped archive completes, fails, times out, or is interrupted. */
export const stopArchive: (process: ArchiveProcess) => Effect.Effect<boolean> = ({ child }) =>
  Effect.sync(() => child.kill('SIGKILL'));
