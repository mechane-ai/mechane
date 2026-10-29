import { SourceGrantState, SourceReport } from '@mechane/protocol';
import { Effect, Option, Redacted, Schema } from 'effect';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { check } from '../check.ts';
import { refusedOperation } from '../cli/refused-operation.ts';
import { runCli } from '../cli/run-cli.ts';
import { RefusalCode } from '../constants.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { sourceGrantFixture } from './source-grant-fixture.ts';

type VerifySourceGrantAccessInput = WorkspaceAuthorityInput & { readonly guarantee: string };
type GrantStateTextInput = { readonly state: SourceGrantState };

/** Repeated owner reads preserve current authority, and ordinary membership cannot inspect the grant. */
export const verifySourceGrantAccess = Effect.fn('verifySourceGrantAccess')(function* ({
  stack,
  workspace,
  member,
  guarantee,
}: VerifySourceGrantAccessInput): Effect.fn.Return<void, ScenarioFailure> {
  const fixture = yield* sourceGrantFixture({ stack, workspace });
  const { mechId, absent, first, repeated } = fixture;
  const saved = yield* savedLoginToken({ account: member.account });
  const credential = Redacted.make(saved.token);
  const input = { workspaceId: workspace.workspaceId, mechId };
  const refused = yield* refusedOperation({ stack, name: 'showSourceGrant', input, credential });
  const command = { stack, environment: workspace.owner.environment };
  const selection = ['--workspace', workspace.workspaceId, 'source'];

  yield* runCli({ ...command, args: [...selection, 'revoke', mechId], result: SourceReport });

  const revoked = yield* runCli({ ...command, args: [...selection, 'access', mechId], result: SourceGrantState });
  const before = grantStateText({ state: first });
  const after = grantStateText({ state: repeated });

  const conditions = [
    Option.isNone(absent.grant),
    Option.isSome(first.grant),
    before === after,
    Option.isNone(revoked.result.grant),
    refused === RefusalCode.WorkspaceOwnerRequired,
  ];

  const detail = `source grant is unchanged by repeated reads; member refusal ${refused}`;

  yield* check({ name: guarantee, conditions, detail });
});

function grantStateText({ state }: GrantStateTextInput): string {
  const encoded = Schema.encodeSync(SourceGrantState)(state);

  return JSON.stringify(encoded);
}
