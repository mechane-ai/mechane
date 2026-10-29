import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure } from '@mechane/client';
import type { WorkspaceAccess } from '@mechane/eval';
import type { Finding, FindingList } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { DateTime, Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

type FindingLineInput = { readonly finding: Finding };

/** Lists the current evidence and change state of each finding for a watch. */
export const runFindingList = Effect.fn('runFindingList')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'finding list'>): Effect.fn.Return<CommandResult<'finding list'>, RunFailure> {
  const read: (access: WorkspaceAccess) => Effect.Effect<FindingList, ClientFailure> = ({ token, workspaceId }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'listFindings', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const list = yield* withWorkspace({ call, origin, credentials, use: read });

  return { lines: list.findings.map((finding) => findingLine({ finding })), result: list };
});

function findingLine({ finding }: FindingLineInput): string {
  return `${finding.key}\t${finding.state}\t${finding.change}\t${DateTime.formatIso(finding.observedAt)}\n${finding.summary}\n${finding.evidence.join('\n')}`;
}
