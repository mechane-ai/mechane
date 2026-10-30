import { CredentialList } from '@mechane/protocol';
import { Effect, Redacted } from 'effect';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { check } from '../check.ts';
import { refusedOperation } from '../cli/refused-operation.ts';
import { runCli } from '../cli/run-cli.ts';
import { CREDENTIAL_REFERENCE, RefusalCode } from '../constants.ts';
import type { ScenarioFailure } from '../types.ts';
import type { CredentialScenarioInput } from './types.ts';

/** Ordinary membership must grant neither credential writes nor access through the member's personal workspace. */
export const checkCredentialRefusals = Effect.fn('checkCredentialRefusals')(function* ({
  stack,
  workspace,
  member,
  guarantee,
}: CredentialScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const saved = yield* savedLoginToken({ account: member.account });
  const credential = Redacted.make(saved.token);

  const input = {
    workspaceId: workspace.workspaceId,
    secretReference: CREDENTIAL_REFERENCE,
    value: Redacted.make(stack.modelUpstream.apiKey),
    isCreateOnly: false,
  };

  const refused = yield* refusedOperation({ stack, name: 'putCredential', input, credential });

  const personal = yield* runCli({
    stack,
    args: ['credential', 'list'],
    environment: member.account.environment,
    result: CredentialList,
  });

  const conditions = [personal.result.credentials.length === 0, refused === RefusalCode.WorkspaceOwnerRequired];

  yield* check({
    name: guarantee,
    conditions,
    detail: `credential access ${refused}; personal workspace credentials ${personal.result.credentials.length}`,
  });
});
