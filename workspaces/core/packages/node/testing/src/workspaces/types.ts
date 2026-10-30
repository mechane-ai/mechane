import type { WorkspaceId } from '@mechane/records';
import type { CommandGate, TalkingMech } from '../mechs/types.ts';

/** A mech whose turn waits at its gate with an item queued behind it, and the id of the mech's workspace. */
export type QueuedWorkspace = {
  readonly mech: Pick<TalkingMech, 'id' | 'account'>;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly gate: CommandGate;
};
