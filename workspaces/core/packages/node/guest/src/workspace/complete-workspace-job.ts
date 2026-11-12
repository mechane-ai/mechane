import { Deferred, Effect } from 'effect';
import type { ArchiveWorkspaceInput } from '../archives/archive-workspace.ts';
import type { ObserveStartupPhase } from '../bootstrap/startup-progress.ts';
import type { WorkspaceFailed } from '../errors.ts';
import type { ServedAnswer, WorkspaceFilesInput, WorkspaceRequest } from '../types.ts';
import { workspaceOperation } from './workspace-operation.ts';

type RestorePhaseInput = { readonly onRestorePhase: ObserveStartupPhase };

type CompleteWorkspaceJobInput = WorkspaceFilesInput &
  WorkspaceRequest &
  Pick<ArchiveWorkspaceInput, 'ownedProcessGroups' | 'retainFreeze'> &
  RestorePhaseInput & { readonly result: Deferred.Deferred<ServedAnswer, WorkspaceFailed> };

/** Retains an archive or restore result for later polls without ending the guest when that operation fails. */
export const completeWorkspaceJob = Effect.fn('completeWorkspaceJob')(function* ({
  result,
  ...input
}: CompleteWorkspaceJobInput): Effect.fn.Return<void> {
  const operation = workspaceOperation(input);

  yield* Deferred.complete(result, operation);
});
