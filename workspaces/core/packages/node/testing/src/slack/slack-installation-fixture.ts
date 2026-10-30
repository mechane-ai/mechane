import { SlackInstallationResult, SlackInstallations } from '@mechane/protocol';
import { SlackConnectionId } from '@mechane/records';
import type { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import { CREDENTIAL_REFERENCE } from '../constants.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';

type SlackInstallationFixture = {
  readonly connectionId: SlackConnectionId;
  readonly created: SlackInstallationResult;
  readonly repeated: SlackInstallationResult;
  readonly conflicting: SlackInstallationResult;
  readonly listedCount: number;
};

type SlackConnectArgumentsInput = { readonly workspaceId: WorkspaceId; readonly connectionId: SlackConnectionId };

/** Repeating one connection ID distinguishes an identical import from an attempted configuration replacement. */
export const slackInstallationFixture = Effect.fn('slackInstallationFixture')(function* ({
  stack,
  workspace,
}: WorkspaceAuthorityInput): Effect.fn.Return<SlackInstallationFixture, ScenarioFailure> {
  const connectionId = SlackConnectionId.make(crypto.randomUUID());
  const args = slackConnectArguments({ workspaceId: workspace.workspaceId, connectionId });

  const command = { stack, environment: workspace.owner.environment, result: SlackInstallationResult };
  const created = yield* runCli({ ...command, args });
  const repeated = yield* runCli({ ...command, args: [...args, '--create-only'] });

  const conflicting = yield* runCli({
    ...command,
    args: [...args, '--create-only', '--history-token-secret-reference', 'different'],
  });

  const listed = yield* runCli({
    ...command,
    args: ['--workspace', workspace.workspaceId, 'slack', 'connections'],
    result: SlackInstallations,
  });

  return {
    connectionId,
    created: created.result,
    repeated: repeated.result,
    conflicting: conflicting.result,
    listedCount: listed.result.installations.length,
  };
});

function slackConnectArguments({ workspaceId, connectionId }: SlackConnectArgumentsInput): ReadonlyArray<string> {
  return [
    '--workspace',
    workspaceId,
    'slack',
    'connect',
    connectionId,
    '--team-id',
    'T_SMOKE',
    '--bot-user-id',
    'U_SMOKE',
    '--signing-secret-reference',
    CREDENTIAL_REFERENCE,
    '--bot-token-secret-reference',
    CREDENTIAL_REFERENCE,
  ];
}
