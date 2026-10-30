import { LogEvent } from '@mechane/protocol';
import type { LogLine, WorkspacePolicy } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { RefusalCode } from '../constants.ts';
import type { Account, ScenarioFailure, StackInput } from '../types.ts';
import { awaitLogged } from '../worker-log/await-logged.ts';
import { changeWorkspacePolicy } from './change-workspace-policy.ts';
import type { QueuedWorkspace } from './types.ts';

const REFUSED_DISPATCHES = 2;
type LinesInput = { readonly lines: ReadonlyArray<LogLine> };
type AwaitRefusedWorkInput = StackInput & { readonly workspaceId: typeof WorkspaceId.Encoded };
type PauseQueuedWorkspaceInput = StackInput & { readonly administrator: Account; readonly subject: QueuedWorkspace };

/** Suspending while a turn is held forces its queued work to observe the changed policy. */
export const pauseQueuedWorkspace = Effect.fn('pauseQueuedWorkspace')(function* ({
  stack,
  administrator,
  subject,
}: PauseQueuedWorkspaceInput): Effect.fn.Return<WorkspacePolicy, ScenarioFailure> {
  const { mech, workspaceId, gate } = subject;
  const before = stack.modelUpstream.requests();
  const original = yield* changeWorkspacePolicy({ stack, administrator, workspaceId, changes: { isSuspended: true } });

  yield* awaitRefusedWork({ stack, workspaceId });

  const refusal = yield* refusedCli({ stack, args: ['mech', 'list'], environment: mech.account.environment });

  const spent = stack.modelUpstream
    .requests()
    .slice(before.length)
    .filter(({ user }) => user === workspaceId);

  const isNamed = before.some(({ user }) => user === workspaceId);

  yield* gate.open;
  yield* check({
    name: 'workspace suspension immediately stops admission and queued spending',
    conditions: [isNamed, refusal.code === RefusalCode.Suspended, spent.length === 0],
    detail: `workspace named by upstream: ${isNamed}; admission ${refusal.code}; requests after suspension ${spent.length}`,
  });

  return original;
});

const awaitRefusedWork = Effect.fn('awaitRefusedWork')(function* ({
  stack,
  workspaceId,
}: AwaitRefusedWorkInput): Effect.fn.Return<void, ScenarioFailure> {
  const isRefused: (line: LogLine) => boolean = (line) =>
    line.event === LogEvent.DispatchRefused && line.workspaceId === workspaceId;

  const isLogged: (input: LinesInput) => boolean = ({ lines }) => lines.filter(isRefused).length >= REFUSED_DISPATCHES;

  yield* awaitLogged({ stack, awaited: 'the refused dispatches of the suspended workspace', isLogged });
});
