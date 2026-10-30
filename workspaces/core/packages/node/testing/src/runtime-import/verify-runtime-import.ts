import { COMMAND_OUTPUTS } from '@mechane/cli-kernel';
import { SlackInstallationResult } from '@mechane/protocol';
import { Effect } from 'effect';
import { check } from '../check.ts';
import { runCli } from '../cli/run-cli.ts';
import { CREDENTIAL_REFERENCE } from '../constants.ts';
import { CheckFailed } from '../errors.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { IMPORTED_CREDENTIAL_REFERENCE } from './constants.ts';
import { runtimeImportFixture } from './runtime-import-fixture.ts';
import { verifyImportedPolicy } from './verify-imported-policy.ts';

const IMPORTED_CREDENTIALS_COUNT = 2;

type VerifyRuntimeImportInput = WorkspaceAuthorityInput & {
  readonly guarantee: string;
  readonly created: SlackInstallationResult;
};

/** The retained credential is exercised by the signed Slack callback after both import attempts. */
export const verifyRuntimeImport = Effect.fn('verifyRuntimeImport')(function* ({
  guarantee,
  created,
  ...authority
}: VerifyRuntimeImportInput): Effect.fn.Return<void, ScenarioFailure> {
  if (!SlackInstallationResult.guards.Configured(created)) {
    return yield* new CheckFailed({ name: guarantee, reason: 'Slack import fixture was not configured' });
  }

  const { stack, workspace } = authority;
  const args = yield* runtimeImportFixture({ ...authority, installation: created.installation });

  const command = {
    stack,
    args,
    environment: workspace.owner.environment,
    result: COMMAND_OUTPUTS['workspace import'],
  };

  const first = yield* runCli(command);
  const repeated = yield* runCli(command);

  const conditions = [
    first.result.importedCredentials.includes(IMPORTED_CREDENTIAL_REFERENCE),
    first.result.retainedCredentials.includes(CREDENTIAL_REFERENCE),
    repeated.result.importedCredentials.length === 0,
    repeated.result.retainedCredentials.length === IMPORTED_CREDENTIALS_COUNT,
    !first.output.includes(stack.modelUpstream.apiKey),
    !repeated.output.includes(stack.modelUpstream.apiKey),
  ];

  yield* check({ name: guarantee, conditions, detail: 'runtime import retained existing credentials across retries' });
  yield* verifyImportedPolicy({ ...authority, guarantee });
});
