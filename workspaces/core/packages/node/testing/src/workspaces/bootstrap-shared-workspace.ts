import { Workspace } from '@mechane/protocol';
import { LOCAL_OWNER_IDENTITY, PrincipalId, WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { randomBytes } from 'node:crypto';
import { freshAccount } from '../accounts/fresh-account.ts';
import { approvedLocalCli } from '../approvals/approved-local-cli.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import { SignedIn } from '../schemas.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import type { SharedWorkspaceFixture } from './types.ts';

const BOOTSTRAP_SECRET_BYTES = 32;

/** The shared workspace predates its prospective member, and repeated creation reuses its ID. */
export const bootstrapSharedWorkspace = Effect.fn('bootstrapSharedWorkspace')(function* ({
  stack,
}: StackInput): Effect.fn.Return<SharedWorkspaceFixture, ScenarioFailure> {
  const owner = yield* freshAccount({ stack });
  const bootstrapSecret = randomBytes(BOOTSTRAP_SECRET_BYTES).toString('hex');
  const administratorIdentities = JSON.stringify([LOCAL_OWNER_IDENTITY]);

  yield* stack.restart({ variables: { localBootstrapSecret: bootstrapSecret, administratorIdentities } });

  const approval = { stack, args: ['auth', 'login'], account: owner, result: SignedIn, bootstrapSecret };
  const login = yield* approvedLocalCli(approval);
  const ownerPrincipalId = PrincipalId.make(login.result.principal.id);
  const workspaceId = WorkspaceId.make(crypto.randomUUID());
  const args = ['workspace', 'create', '--name', 'Shared smoke workspace', '--workspace-id', workspaceId];
  const creation = { stack, args, environment: owner.environment, result: Workspace };
  const first = yield* runCli(creation);
  const repeated = yield* runCli(creation);
  const conflictArgs = ['workspace', 'create', '--name', 'Changed intent', '--workspace-id', workspaceId];
  const conflict = yield* refusedCli({ ...creation, args: conflictArgs });

  yield* stack.restart({ variables: { administratorIdentities } });

  return { owner, ownerPrincipalId, workspaceId, created: first.result, repeated: repeated.result, conflict };
});
