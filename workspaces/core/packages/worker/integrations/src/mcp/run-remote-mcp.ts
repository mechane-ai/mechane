import type { RemoteToolsOutcome } from '@mechane/protocol';
import { closeRemoteSession } from './close-remote-session.ts';
import { openRemoteSession } from './open-remote-session.ts';
import { readRemoteSession } from './read-remote-session.ts';
import type { RemoteMcpInput } from './types.ts';

/** Owns session cleanup and preserves a cleanup failure alongside the primary outcome. */
export async function runRemoteMcp({ ...input }: RemoteMcpInput): Promise<RemoteToolsOutcome> {
  const session = openRemoteSession(input);
  const outcome = await readRemoteSession({ ...input, ...session });
  const isClosed = await closeRemoteSession({ client: session.client });

  if (!isClosed) {
    return { ...outcome, cleanupFailed: true };
  }

  return outcome;
}
