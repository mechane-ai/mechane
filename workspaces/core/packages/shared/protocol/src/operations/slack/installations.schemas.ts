import { SecureOrigin } from '@mechane/deployment';
import { SlackConnectionId, SlackTeamId, SlackUserId, wireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';

/** The workspace and installation identity also name the signed Slack callback. */
export const SlackInstallationPath = wireStruct({
  fields: { workspaceId: WorkspaceId, connectionId: SlackConnectionId },
});

export type SlackInstallationPath = typeof SlackInstallationPath.Type;

/** Runtime metadata retains the callback identity and references workspace credentials. */
export const SlackInstallation = wireStruct({
  fields: {
    id: SlackConnectionId,
    workspaceId: WorkspaceId,
    teamId: SlackTeamId,
    botUserId: SlackUserId,
    signingSecretReference: Schema.NonEmptyString,
    botTokenSecretReference: Schema.NonEmptyString,
    /** Absence uses the bot credential for history reads. */
    historyTokenSecretReference: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
    apiOrigin: SecureOrigin,
  },
});

export type SlackInstallation = typeof SlackInstallation.Type;

/** Owner listings expose installation metadata while credential values stay in the vault. */
export const SlackInstallations = Schema.Struct({ installations: Schema.Array(SlackInstallation) });
export type SlackInstallations = typeof SlackInstallations.Type;

/** A create-only import reuses matching metadata or reports a conflict without replacing it. */
export const SlackInstallationResult = Schema.TaggedUnion({
  Configured: { installation: SlackInstallation },
  Conflicting: {},
});

export type SlackInstallationResult = typeof SlackInstallationResult.Type;

/** Deletion acknowledges the installation whose callback and replies were disabled. */
export const SlackInstallationDeletion = wireStruct({ fields: { connectionId: SlackConnectionId } });
export type SlackInstallationDeletion = typeof SlackInstallationDeletion.Type;
