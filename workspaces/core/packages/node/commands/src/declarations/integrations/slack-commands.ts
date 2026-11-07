import { NoFields, SlackChannelKind } from '@mechane/protocol';
import {
  MechId,
  renamedWireStruct,
  SlackBindingId,
  SlackChannelId,
  SlackConnectionId,
  SlackTeamId,
  SlackUserId,
} from '@mechane/records';
import { Effect, Schema, SchemaTransformation } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { MECH_ARGUMENT } from '../constants.ts';

const SlackSwitchValue = { Enabled: 'true', Disabled: 'false' } as const;
type SlackSwitchValue = (typeof SlackSwitchValue)[keyof typeof SlackSwitchValue];

const encodeSlackSwitch: (isEnabled: boolean) => SlackSwitchValue = (isEnabled) => {
  if (isEnabled) {
    return SlackSwitchValue.Enabled;
  }

  return SlackSwitchValue.Disabled;
};

const SlackSwitch = Schema.Enum(SlackSwitchValue).pipe(
  Schema.decodeTo(
    Schema.Boolean,
    SchemaTransformation.transform({
      decode: (value) => value === SlackSwitchValue.Enabled,
      encode: encodeSlackSwitch,
    }),
  ),
);

const SlackAllowedUsers = Schema.NonEmptyArray(SlackUserId);
const SlackAllowedUsersJson = Schema.fromJsonString(SlackAllowedUsers);
const OptionalSlackAllowedUsersJson = Schema.optionalKey(SlackAllowedUsersJson);

const SlackChannelKindField = Schema.Enum(SlackChannelKind).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(SlackChannelKind.Channel)),
);

/** Owner binding commands and member-readable delivery receipts. */
export const SLACK_COMMANDS = {
  'slack bind': {
    summary: 'bind one existing Slack channel to one mech, or change its listening and reply switches',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'configureSlackBinding'],
    flags: {
      'binding-id': {
        kind: FlagKind.Text,
        summary: 'the persistent UUID for this binding, reused on changes and retries',
      },
      'connection-id': { kind: FlagKind.Text, summary: 'the configured existing Slack installation' },
      'team-id': { kind: FlagKind.Text, summary: 'the Slack workspace ID' },
      'channel-id': { kind: FlagKind.Text, summary: 'the existing Slack channel ID' },
      'channel-kind': { kind: FlagKind.Text, summary: 'channel, im, or mpim; channel when absent' },
      'listening': { kind: FlagKind.Text, summary: 'true to receive human messages, false to stop receiving' },
      'replies': { kind: FlagKind.Text, summary: 'true to deliver replies and notifications, false to mute them' },
      'allowed-user-ids': {
        kind: FlagKind.Text,
        summary: 'a JSON array of trusted Slack user IDs; omit to trust the channel',
      },
    },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({
      fields: {
        id: SlackBindingId,
        connectionId: SlackConnectionId,
        teamId: SlackTeamId,
        channelId: SlackChannelId,
        channelKind: SlackChannelKindField,
        mechId: MechId,
        isListening: SlackSwitch,
        isReplyEnabled: SlackSwitch,
        allowedUserIds: OptionalSlackAllowedUsersJson,
      },
      renames: {
        id: 'binding-id',
        connectionId: 'connection-id',
        teamId: 'team-id',
        channelId: 'channel-id',
        channelKind: 'channel-kind',
        mechId: 'mech-id',
        isListening: 'listening',
        isReplyEnabled: 'replies',
        allowedUserIds: 'allowed-user-ids',
      },
    }),
  },
  'slack bindings': {
    summary: 'list Slack channel bindings and their listening and reply switches',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listSlackBindings'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'slack deliveries': {
    summary: 'inspect the latest Slack delivery receipts, including uncertain outcomes that need review',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listSlackDeliveries'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId }, renames: { mechId: 'mech-id' } }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
