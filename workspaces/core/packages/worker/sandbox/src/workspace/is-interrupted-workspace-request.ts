import { Option, Schema } from 'effect';
import { WorkspaceTransferFailed, WorkspaceTransferPhase } from '../errors.ts';

type WorkspaceRequestFailureInput = { readonly cause: unknown };

/** The transport ended before the guest returned any HTTP response. */
export function isInterruptedWorkspaceRequest({ cause }: WorkspaceRequestFailureInput): boolean {
  if (!Schema.is(WorkspaceTransferFailed)(cause)) {
    return false;
  }

  const observation = Option.fromUndefinedOr(cause.observation);

  return Option.exists(observation, ({ phase }) => phase === WorkspaceTransferPhase.Request);
}
