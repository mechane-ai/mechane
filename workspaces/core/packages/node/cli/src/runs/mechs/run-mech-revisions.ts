import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { MechRevision } from '@mechane/protocol';
import { DateTime, Effect } from 'effect';
import { withWorkspace } from './with-workspace.ts';

/** Lists saved definition revisions with the actor and time of each change. */
export const runMechRevisions = Effect.fn('runMechRevisions')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'mech revisions'>): Effect.fn.Return<CommandResult<'mech revisions'>, RunFailure> {
  const page = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'listMechRevisions', input: { ...input, workspaceId }, credential: token }),
  });

  const revisionLine: (revision: MechRevision) => string = (revision) =>
    `${revision.revision} ${revision.name} (${revision.model}) ${revision.status} by ${revision.updaterId} at ${DateTime.formatIso(revision.updatedAt)}`;

  const lines = page.revisions.map(revisionLine);

  if (page.hasMore) {
    lines.push('More revisions follow; use --after with the last revision shown.');
  }

  return { lines, result: page };
});
