import { SecureOrigin } from '@mechane/deployment';
import { HttpMethod, SlackTeamId, SlackUserId, wireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { IntegrationSecretReference } from '../connections/schemas.ts';
import { SlackInstallationPath, SlackInstallationResult } from './installations.schemas.ts';

const SlackInstallationWrite = wireStruct({
  fields: {
    teamId: SlackTeamId,
    botUserId: SlackUserId,
    signingSecretReference: IntegrationSecretReference,
    botTokenSecretReference: IntegrationSecretReference,
    /** Null uses the bot credential for history reads. */
    historyTokenSecretReference: Schema.OptionFromNullOr(IntegrationSecretReference),
    apiOrigin: SecureOrigin,
    /** Omission permits replacement; true preserves a conflicting existing installation. */
    isCreateOnly: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  },
});

type SlackInstallationWrite = typeof SlackInstallationWrite.Type;

/** Owners configure Slack metadata while keeping credential values in the workspace vault. */
export const configureSlackInstallation = {
  method: HttpMethod.Put,
  path: '/v1/workspaces/:workspace_id/slack-installations/:connection_id',
  access: Access.Member,
  params: SlackInstallationPath,
  query: NoFields,
  body: SlackInstallationWrite,
  output: SlackInstallationResult,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
