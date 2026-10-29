import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { SourceReport } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

type SourceCommand = 'source grant' | 'source revoke' | 'source checkout' | 'source publish' | 'source show';

/** Prints source progress and unresolved publication diagnostics without exposing server credential material. */
export const runSource = Effect.fn('runSource')(function* <N extends SourceCommand>({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<N>): Effect.fn.Return<CommandResult<N>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<N>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => call({ name: 'manageSource', input: { ...input, workspaceId }, credential: token });

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  if (SourceReport.guards.Configured(result)) {
    return { lines: ['repository grant saved'], result };
  }

  const source = result.source;
  const lines = [`${source.sourceId}: ${source.status}; ${source.directory} at ${source.commit}`];

  if (Option.isSome(source.publicationStatus)) {
    lines.push(`draft publication: ${source.publicationStatus.value}`);
  }

  if (Option.isSome(source.pullRequestUrl)) {
    lines.push(source.pullRequestUrl.value);
  }

  if (Option.isSome(source.reason)) {
    lines.push(source.reason.value);
  }

  return { lines, result };
});
