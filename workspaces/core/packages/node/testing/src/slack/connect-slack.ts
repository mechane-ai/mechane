import { SlackBindingResult, SlackInstallationResult } from '@mechane/protocol';
import { randomUUID } from 'node:crypto';
import { runCli } from '../cli/run-cli.ts';
import { installCredential } from '../credentials.ts';
import { requireFixtures } from '../fixtures.ts';
import type { MechContext } from '../types.ts';

export type ConnectedSlack = {
  readonly connectionId: string;
  readonly teamId: string;
  readonly channelId: string;
  readonly userId: string;
  readonly signingSecret: string;
};

export async function connectSlack(input: MechContext): Promise<ConnectedSlack> {
  const { stack, account, mechId } = input;
  const fixture = requireFixtures(stack).slack;
  const connectionId = randomUUID();
  const signingReference = `slack-signing-${connectionId}`;
  const botReference = `slack-bot-${connectionId}`;

  const values = [
    { reference: signingReference, value: fixture.signingSecret },
    { reference: botReference, value: fixture.botToken },
  ];

  for (const credential of values) {
    await installCredential({ stack, account, ...credential });
  }

  const installation = await runCli({
    stack,
    account,
    args: [
      'slack',
      'connect',
      connectionId,
      '--workspace',
      account.workspaceId,
      '--team-id',
      fixture.teamId,
      '--bot-user-id',
      fixture.botUserId,
      '--signing-secret-reference',
      signingReference,
      '--bot-token-secret-reference',
      botReference,
      '--api-origin',
      fixture.origin.origin,
    ],
    schema: SlackInstallationResult,
  });

  if (installation._tag !== 'Configured') {
    throw new Error('The smoke Slack installation was not configured');
  }

  const channelId = 'C00000001';
  const userId = 'U00000001';

  const binding = await runCli({
    stack,
    account,
    args: [
      'slack',
      'bind',
      mechId,
      '--workspace',
      account.workspaceId,
      '--binding-id',
      randomUUID(),
      '--connection-id',
      connectionId,
      '--team-id',
      fixture.teamId,
      '--channel-id',
      channelId,
      '--listening',
      'true',
      '--replies',
      'true',
      '--allowed-user-ids',
      JSON.stringify([userId]),
    ],
    schema: SlackBindingResult,
  });

  if (binding._tag !== 'Configured') {
    throw new Error('The smoke Slack channel was not bound');
  }

  return { connectionId, teamId: fixture.teamId, channelId, userId, signingSecret: fixture.signingSecret };
}
