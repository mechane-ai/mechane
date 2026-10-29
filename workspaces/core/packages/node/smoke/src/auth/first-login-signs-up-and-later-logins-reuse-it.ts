import { MembershipRole, Principal, Workspace, WorkspaceList } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  approvedCli,
  approvedLocalCli,
  check,
  freshAccount,
  runCli,
  SignedIn,
  submitBootstrap,
} from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import { randomBytes } from 'node:crypto';

const BOOTSTRAP_SECRET_BYTES = 32;

/** The part of `mechane auth status`'s result beside the account: the workspaces. */
const SignedInWorkspaces = Schema.Struct({ principal: Principal, workspaces: Schema.Array(Workspace) });

type SignedInWorkspaces = typeof SignedInWorkspaces.Type;

/**
 * Logs a fresh account in twice: the first login signs it up with one owned workspace, and the second reuses its
 * principal and workspaces.
 */
export const firstLoginSignsUpAndLaterLoginsReuseIt = Effect.fn('firstLoginSignsUpAndLaterLoginsReuseIt')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const account = yield* freshAccount({ stack });
  const { environment } = account;
  const login = { stack, args: ['auth', 'login'], account, result: SignedIn };
  const first = yield* approvedCli(login);
  const signedUp = yield* runCli({ stack, args: ['workspace', 'list'], environment, result: WorkspaceList });
  const second = yield* approvedCli(login);
  const status = yield* runCli({ stack, args: ['auth', 'status'], environment, result: SignedInWorkspaces });
  const owned = signedUp.result.workspaces.filter((workspace) => workspace.role === MembershipRole.Owner);
  const before = signedUp.result.workspaces.map((workspace) => workspace.id).join(', ');
  const after = status.result.workspaces.map((workspace) => workspace.id).join(', ');
  const principals = [first, second, status].map(({ result }) => result.principal.id);
  const isSignedUp = owned.length === 1 && signedUp.result.workspaces.length === 1;
  const isReused = new Set(principals).size === 1 && before === after;

  yield* check({
    name: guarantee,
    conditions: [isSignedUp, isReused, first.result.principal.name === account.login],
    detail: `principals ${principals.join(', ')} for ${account.login}; workspaces ${before}, then ${after}`,
  });

  yield* localLogin({ stack, guarantee });
});

const localLogin = Effect.fn('localLogin')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const account = yield* freshAccount({ stack });
  const bootstrapSecret = randomBytes(BOOTSTRAP_SECRET_BYTES).toString('hex');
  const variables = { localBootstrapSecret: bootstrapSecret };
  const url = stack.origin;

  yield* stack.restart({ variables });

  const foreign = yield* submitBootstrap({ url, secret: bootstrapSecret, origin: stack.githubOrigin.origin });
  const wrong = yield* submitBootstrap({ url, secret: 'incorrect-bootstrap-secret', origin: url.origin });
  const login = { stack, args: ['auth', 'login'], account, result: SignedIn, bootstrapSecret };
  const first = yield* approvedLocalCli(login);

  yield* stack.restart({ variables });

  const second = yield* approvedLocalCli(login);
  const isReused = first.result.principal.id === second.result.principal.id;

  yield* stack.restart({ variables: {} });
  yield* check({
    name: guarantee,
    conditions: [foreign.status === HttpStatusCode.Forbidden, wrong.status === HttpStatusCode.Forbidden, isReused],
    detail: `bootstrap statuses ${foreign.status}, ${wrong.status}; local owner reused: ${isReused}`,
  });
});
