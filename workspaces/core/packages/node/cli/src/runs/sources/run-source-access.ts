import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { SourceGrantState } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Grant inspection reports absent authority explicitly and leaves the saved grant unchanged. */
export const runSourceAccess = Effect.fn('runSourceAccess')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'source access'>): Effect.fn.Return<CommandResult<'source access'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<SourceGrantState, RunFailure> = ({ token, workspaceId }) =>
    call({ name: 'showSourceGrant', input: { ...input, workspaceId }, credential: token });

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  if (Option.isNone(result.grant)) {
    return { lines: ['No repository grant.'], result };
  }

  const grant = result.grant.value;
  const paths = grant.writePaths.join(', ');
  const line = `${grant.owner}/${grant.repository}: ${grant.baseBranch}; writable paths ${paths}`;

  return { lines: [line], result };
});
