import { WorkspaceList } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import { signedInMech } from '../mechs/signed-in-mech.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';

type WorkspaceMech = { readonly mech: TalkingMech; readonly workspaceId: typeof WorkspaceId.Encoded };

/** A fresh account has one personal workspace, whose policy can govern its talking mech. */
export const signedInWorkspaceMech = Effect.fn('signedInWorkspaceMech')(function* ({
  stack,
}: StackInput): Effect.fn.Return<WorkspaceMech, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });

  const workspaces = yield* runCli({
    stack,
    args: ['workspace', 'list'],
    environment: mech.account.environment,
    result: WorkspaceList,
  });

  return { mech, workspaceId: workspaces.result.workspaces[0].id };
});
