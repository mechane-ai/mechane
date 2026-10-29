import { SlackConnectionId, SlackTeamId, SlackUserId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { SecureOrigin } from './schemas.ts';

/** An existing Slack installation; reusable credentials stay in the workspace's server secret map. */
export const SlackInstallation = Schema.Struct({
  id: SlackConnectionId,
  workspaceId: WorkspaceId,
  teamId: SlackTeamId,
  botUserId: SlackUserId,
  signingSecretReference: Schema.NonEmptyString,
  botTokenSecretReference: Schema.NonEmptyString,
  /** Absent to use the bot credential for history reads. */
  historyTokenSecretReference: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
  apiOrigin: SecureOrigin,
});

export type SlackInstallation = typeof SlackInstallation.Type;

/** Serialized metadata for existing Slack installations; credential values are held separately. */
export const SlackInstallationsVariable = Schema.fromJsonString(Schema.Array(SlackInstallation));

export type SlackInstallationsVariable = typeof SlackInstallationsVariable.Type;
