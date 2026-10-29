import { EventType, LogEvent } from '@mechane/protocol';
import type { LogLine } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import type { Stack } from '@mechane/stack';
import {
  awaitLogged,
  check,
  RefusalCode,
  refusedCli,
  refuseUnlistedMaintenance,
  signedInMech,
  turnOutcome,
} from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { privateIdentitiesCannotSpend } from './private-identities-cannot-spend.ts';
import { queuedWork } from './queued-work.ts';

/** What the unlisted workspace's command would print, had the deployment given it a machine. */
const LISTED_OUTPUT = 'a-machine-ran';

/** What the bash tool tells the model of a workspace without a sandbox. */
const NO_SANDBOX_REPLY = 'This workspace has no sandbox';

/** The suspended workspace's dispatches the deployment refuses: its running turn's next one, and its queued turn's. */
const REFUSED_DISPATCHES = 2;

/** The Worker's lines a wait reads. */
type LinesInput = { readonly lines: ReadonlyArray<LogLine> };

/** The stack, and the suspended workspace whose refused dispatches to wait for. */
type RefusedWorkInput = { readonly stack: Stack; readonly workspaceId: string };

/**
 * One workspace's turn waits at a gate with an item queued behind it when the deployment restarts with lists that give
 * no workspace a sandbox and suspend that one. Another workspace's bash is then refused before any machine, the
 * suspended one's member call is refused, and a last restart restores the lists. Its turn and queued turn each end on
 * one refused dispatch, so the upstream receives only its first request, which named its workspace as the end user.
 */
export const operatorListsCutWorkspacesOffAtTheNextDeploy = Effect.fn('operatorListsCutWorkspacesOffAtTheNextDeploy')(
  function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
    const { mech: suspended, workspaceId, gate } = yield* queuedWork({ stack });
    const before = stack.modelUpstream.requests();

    yield* stack.restart({
      variables: { sandboxWorkspaces: '[]', suspendedWorkspaces: JSON.stringify([workspaceId]) },
    });

    const unlisted = yield* signedInMech({ stack, offer: 'echo' });
    const { ended } = yield* unlisted.turn({ text: `${COMMAND_PREFIX}echo ${LISTED_OUTPUT}` });

    yield* refuseUnlistedMaintenance({ stack, mech: unlisted });

    yield* refusedWork({ stack, workspaceId });

    const refusal = yield* refusedCli({ stack, args: ['mech', 'list'], environment: suspended.account.environment });

    const spent = stack.modelUpstream
      .requests()
      .slice(before.length)
      .filter(({ user }) => user === workspaceId);

    const isNamed = before.some(({ user }) => user === workspaceId);
    const isRefused = ended.type === EventType.TurnAnswered && ended.reply.includes(NO_SANDBOX_REPLY);

    yield* gate.open;
    yield* stack.restart({ variables: {} });
    yield* check({
      name: guarantee,
      conditions: [isNamed, isRefused, refusal.code === RefusalCode.Suspended, spent.length === 0],
      detail: `the suspended workspace was named as an end user: ${isNamed}; the unlisted workspace's turn ended ${turnOutcome({ ended })}; the suspended workspace's call answered ${refusal.code}, and its work sent ${spent.length} requests`,
    });

    yield* privateIdentitiesCannotSpend({ stack, guarantee });
  },
  Effect.scoped,
);

/** Waits until the Worker logged the refused dispatches of the suspended workspace's two turns. */
const refusedWork = Effect.fn('refusedWork')(function* ({
  stack,
  workspaceId,
}: RefusedWorkInput): Effect.fn.Return<void, ScenarioFailure> {
  const isRefused: (line: LogLine) => boolean = (line) =>
    line.event === LogEvent.DispatchRefused && line.workspaceId === workspaceId;

  const isLogged: (input: LinesInput) => boolean = ({ lines }) => lines.filter(isRefused).length >= REFUSED_DISPATCHES;

  yield* awaitLogged({ stack, awaited: 'the refused dispatches of the suspended workspace', isLogged });
});
