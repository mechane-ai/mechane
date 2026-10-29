import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { dispatchLine } from '../observe/dispatch-line.ts';
import { indentedText } from '../observe/indented-text.ts';
import { droneLine } from './drone-line.ts';

/** Shows one drone of a mech: its outcome, its brief, and each model request it reserved, as a trace shows them. */
export const runDroneShow = Effect.fn('runDroneShow')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'drone show'>): Effect.fn.Return<CommandResult<'drone show'>, RunFailure> {
  const trace = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'showDrone', input: { ...input, workspaceId }, credential: token }),
  });

  const { drone, brief, dispatches } = trace;

  return {
    lines: [
      droneLine({ drone }),
      ...indentedText({ text: brief }),
      ...dispatches.map((dispatch) => dispatchLine({ dispatch })),
    ],
    result: trace,
  };
});
