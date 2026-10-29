import { PROGRAM } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import { WorkspaceId } from '@mechane/records';
import { Option } from 'effect';

type PrepareWorkspaceCreationInput = {
  /** None generates a new UUID before sending the request. */
  readonly requestedId: Option.Option<WorkspaceId>;
};

/** The retry UUID is printed before a request can create a workspace. */
export function prepareWorkspaceCreation({ requestedId }: PrepareWorkspaceCreationInput): WorkspaceId {
  const workspaceId = Option.getOrElse(requestedId, generateWorkspaceId);

  writeDiagnostic({
    program: PROGRAM,
    line: `workspace create: workspace ${workspaceId}; retry with --workspace-id ${workspaceId} and the same arguments`,
  });

  return workspaceId;
}

function generateWorkspaceId(): WorkspaceId {
  return WorkspaceId.make(crypto.randomUUID());
}
