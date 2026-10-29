import type { LogEvent, LogLine } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import type { Caller } from '../../types.ts';

type WorkspaceActorLogInput = { readonly caller: Caller; readonly workspaceId: typeof WorkspaceId.Encoded };
type WorkspaceCreatedEvent = { readonly event: typeof LogEvent.WorkspaceCreated };
type WorkspaceActorLog = Omit<Extract<LogLine, WorkspaceCreatedEvent>, 'event'>;

/** Grant changes identify both the principal and the credential that exercised authority. */
export function workspaceActorLog({ caller, workspaceId }: WorkspaceActorLogInput): WorkspaceActorLog {
  return { principalId: caller.principal.id, keyId: caller.key.id, workspaceId };
}
