import { SecureOrigin } from '@mechane/deployment';
import { IntegrationSecretReference, NoFields } from '@mechane/protocol';
import { renamedWireStruct, SlackConnectionId, SlackTeamId, SlackUserId } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { OptionalSwitch } from '../switch.schemas.ts';

const SLACK_CONNECTION_ARGUMENT = { name: 'connection-id', summary: 'the persistent Slack installation ID' } as const;

const SlackConnectionInput = renamedWireStruct({
  fields: {
    connectionId: SlackConnectionId,
    teamId: SlackTeamId,
    botUserId: SlackUserId,
    signingSecretReference: IntegrationSecretReference,
    botTokenSecretReference: IntegrationSecretReference,
    historyTokenSecretReference: Schema.OptionFromOptionalKey(IntegrationSecretReference),
    apiOrigin: SecureOrigin.pipe(Schema.withDecodingDefaultKey(Effect.succeed('https://slack.com'))),
    isCreateOnly: OptionalSwitch,
  },
  renames: {
    connectionId: 'connection-id',
    teamId: 'team-id',
    botUserId: 'bot-user-id',
    signingSecretReference: 'signing-secret-reference',
    botTokenSecretReference: 'bot-token-secret-reference',
    historyTokenSecretReference: 'history-token-secret-reference',
    apiOrigin: 'api-origin',
    isCreateOnly: 'create-only',
  },
});

type SlackConnectionInput = typeof SlackConnectionInput.Type;

/** Workspace owners connect Slack using stable references to credentials managed separately in the workspace vault. */
export const SLACK_INSTALLATION_COMMANDS = {
  'slack connect': {
    summary: 'configure a Slack installation using workspace credential references',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'configureSlackInstallation'],
    flags: {
      'team-id': { kind: FlagKind.Text, summary: 'the Slack workspace ID' },
      'bot-user-id': { kind: FlagKind.Text, summary: 'the installed Slack bot user ID' },
      'signing-secret-reference': {
        kind: FlagKind.Text,
        summary: 'the workspace credential that verifies Slack events',
      },
      'bot-token-secret-reference': { kind: FlagKind.Text, summary: 'the workspace credential used to post replies' },
      'history-token-secret-reference': {
        kind: FlagKind.Text,
        summary: 'the workspace history credential; omit to use the bot token',
      },
      'api-origin': { kind: FlagKind.Text, summary: 'the Slack API origin; defaults to https://slack.com' },
      'create-only': { kind: FlagKind.Switch, summary: 'refuse changes to an existing installation during an import' },
    },
    arguments: [SLACK_CONNECTION_ARGUMENT],
    input: SlackConnectionInput,
  },
  'slack connections': {
    summary: 'list the workspace Slack installations without resolving credential values',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listSlackInstallations'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'slack disconnect': {
    summary: 'remove a Slack installation and stop its event and reply delivery',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'deleteSlackInstallation'],
    flags: {},
    arguments: [SLACK_CONNECTION_ARGUMENT],
    input: renamedWireStruct({
      fields: { connectionId: SlackConnectionId },
      renames: { connectionId: 'connection-id' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
