import { PrivateMode } from '@mechane/program';
import { CredentialMetadata } from '@mechane/protocol';
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from '../cli/run-cli.ts';
import { CREDENTIAL_REFERENCE, FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { CliRun, ScenarioFailure, SharedWorkspaceFixture, StackInput } from '../types.ts';

type CredentialFixtureInput = StackInput & { readonly workspace: SharedWorkspaceFixture };
type CredentialFixture = { readonly args: ReadonlyArray<string>; readonly saved: CliRun<CredentialMetadata> };

/** Reusing the model's sentinel makes integration credential leaks visible to the stack's final token scan. */
export const credentialFixture = Effect.fn('credentialFixture')(function* ({
  stack,
  workspace,
}: CredentialFixtureInput): Effect.fn.Return<CredentialFixture, ScenarioFailure> {
  const file = join(workspace.owner.configurationRoot, 'integration-credential');

  yield* Effect.tryPromise({
    try: () => writeFile(file, stack.modelUpstream.apiKey, { mode: PrivateMode.File }),
    catch: () =>
      new FileStepFailed({ step: FileStep.Write, path: file, reason: 'could not write private credential fixture' }),
  });

  const args = ['--workspace', workspace.workspaceId, 'credential', 'put', CREDENTIAL_REFERENCE, '--file', file];
  const saved = yield* runCli({ stack, args, environment: workspace.owner.environment, result: CredentialMetadata });

  return { args, saved };
});
