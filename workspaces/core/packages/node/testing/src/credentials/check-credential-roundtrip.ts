import { CredentialDeletion, CredentialList } from '@mechane/protocol';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { runCli } from '../cli/run-cli.ts';
import { CREDENTIAL_REFERENCE, RefusalCode } from '../constants.ts';
import type { ScenarioFailure } from '../types.ts';
import { credentialFixture } from './credential-fixture.ts';
import type { CredentialScenarioInput } from './types.ts';

/** Reusing a reference must refuse create-only writes without exposing the value in command output. */
export const checkCredentialRoundtrip = Effect.fn('checkCredentialRoundtrip')(function* ({
  stack,
  workspace,
  guarantee,
}: CredentialScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const fixture = yield* credentialFixture({ stack, workspace });
  const command = { stack, environment: workspace.owner.environment };
  const existing = yield* refusedCli({ ...command, args: [...fixture.args, '--create-only'] });
  const selection = ['--workspace', workspace.workspaceId, 'credential'];
  const listed = yield* runCli({ ...command, args: [...selection, 'list'], result: CredentialList });

  yield* runCli({ ...command, args: [...selection, 'delete', CREDENTIAL_REFERENCE], result: CredentialDeletion });

  const deleted = yield* runCli({ ...command, args: [...selection, 'list'], result: CredentialList });
  const outputs = [fixture.saved.output, existing.output, listed.output, deleted.output];
  const isRedacted: (output: string) => boolean = (output) => !output.includes(stack.modelUpstream.apiKey);
  const isPrivate = outputs.every(isRedacted);

  const conditions = [
    listed.result.credentials.length === 1,
    deleted.result.credentials.length === 0,
    existing.code === RefusalCode.CredentialAlreadyExists,
    isPrivate,
  ];

  yield* credentialFixture({ stack, workspace });
  yield* check({
    name: guarantee,
    conditions,
    detail: `credential import ${existing.code}; metadata values private ${isPrivate}`,
  });
});
