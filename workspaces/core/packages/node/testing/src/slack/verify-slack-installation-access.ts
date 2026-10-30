import { SlackInstallationDeletion, SlackInstallationResult } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Effect, Redacted } from 'effect';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { check } from '../check.ts';
import { refusedOperation } from '../cli/refused-operation.ts';
import { runCli } from '../cli/run-cli.ts';
import { RefusalCode } from '../constants.ts';
import { verifyRuntimeImport } from '../runtime-import/verify-runtime-import.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';
import { slackChallenge } from './slack-challenge.ts';
import { slackInstallationFixture } from './slack-installation-fixture.ts';

type VerifySlackInstallationAccessInput = WorkspaceAuthorityInput & { readonly guarantee: string };

/** A signed callback must survive import retries and stop working after its installation is deleted. */
export const verifySlackInstallationAccess = Effect.fn('verifySlackInstallationAccess')(function* ({
  guarantee,
  ...authority
}: VerifySlackInstallationAccessInput): Effect.fn.Return<void, ScenarioFailure> {
  const { stack, workspace, member } = authority;
  const fixture = yield* slackInstallationFixture(authority);

  yield* verifyRuntimeImport({ ...authority, guarantee, created: fixture.created });

  const signingSecret = stack.modelUpstream.apiKey;
  const signed = { stack, workspaceId: workspace.workspaceId, connectionId: fixture.connectionId, signingSecret };
  const accepted = yield* slackChallenge(signed);
  const invalid = yield* slackChallenge({ ...signed, signingSecret: 'incorrect-slack-secret' });
  const foreign = yield* slackChallenge({ ...signed, workspaceId: member.personalWorkspaceId });
  const refused = yield* refuseSlackInstallationRead(authority);
  const command = { stack, environment: workspace.owner.environment, result: SlackInstallationDeletion };
  const args = ['--workspace', workspace.workspaceId, 'slack', 'disconnect', fixture.connectionId];

  yield* runCli({ ...command, args });

  const deleted = yield* slackChallenge(signed);

  const conditions = [
    [fixture.created, fixture.repeated].every(SlackInstallationResult.guards.Configured),
    SlackInstallationResult.guards.Conflicting(fixture.conflicting),
    fixture.listedCount === 1,
    refused === RefusalCode.WorkspaceOwnerRequired,
    accepted.status === HttpStatusCode.Ok,
    invalid.status === HttpStatusCode.Unauthorized,
    foreign.status === HttpStatusCode.NotFound,
    deleted.status === HttpStatusCode.NotFound,
  ];

  const detail = `Slack owner ${refused}; callbacks ${accepted.status}, ${foreign.status}, ${deleted.status}`;

  yield* check({ name: guarantee, conditions, detail });
});

const refuseSlackInstallationRead = Effect.fn('refuseSlackInstallationRead')(function* ({
  stack,
  workspace,
  member,
}: WorkspaceAuthorityInput): Effect.fn.Return<string, ScenarioFailure> {
  const saved = yield* savedLoginToken({ account: member.account });
  const credential = Redacted.make(saved.token);
  const input = { workspaceId: workspace.workspaceId };

  return yield* refusedOperation({ stack, credential, name: 'listSlackInstallations', input });
});
