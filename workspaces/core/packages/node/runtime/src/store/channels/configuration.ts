import type { SlackBinding, SlackInstallation } from '../../domain.ts';
import { recordConfigurationChange } from '../api/configuration/audit.ts';
import {
  lockWorkspaceAuthority,
  requireCredentialReferences,
  requireWorkspaceMech,
} from '../api/configuration/authority.ts';
import type {
  BindingConfiguration,
  BindingResult,
  InstallationConfiguration,
  InstallationResult,
  WorkspaceActor,
} from '../api/configuration/types.ts';
import type { StoreContext } from '../context.ts';
import { createBindingStore } from './bindings.ts';
import { createInstallationStore } from './installations.ts';

type InstallationWrite = WorkspaceActor & {
  readonly installation: InstallationConfiguration;
  readonly isCreateOnly: boolean;
};

type InstallationDelete = WorkspaceActor & { readonly installationId: string };
type BindingWrite = WorkspaceActor & { readonly binding: BindingConfiguration };

export function createChannelConfigurationRecords(context: StoreContext) {
  return {
    async configureSlackInstallation(input: InstallationWrite): Promise<InstallationResult> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });

        const installations = createInstallationStore(transaction);

        const existing = await installations.getSlackInstallation({
          workspaceId: input.workspaceId,
          installationId: input.installation.id,
        });

        if (input.isCreateOnly) {
          const conflicting = await transaction.client.query(
            'SELECT id FROM mechane.slack_installations WHERE id = $1',
            [input.installation.id],
          );

          if (conflicting.rows.length > 0) {
            if (existing !== null && sameInstallation(existing, input.installation)) {
              return { _tag: 'Configured', installation: existing };
            }

            return { _tag: 'Conflicting' };
          }
        }

        const references = [input.installation.signingSecretReference, input.installation.botTokenReference];

        if (input.installation.historyTokenReference !== null) {
          references.push(input.installation.historyTokenReference);
        }

        await requireCredentialReferences({ context: transaction, workspaceId: input.workspaceId, references });

        const result = await transaction.client.query(
          `INSERT INTO mechane.slack_installations(id,workspace_id,team_id,bot_user_id,signing_secret_reference,bot_token_reference,history_token_reference,api_origin)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT(id) DO UPDATE SET team_id = EXCLUDED.team_id,bot_user_id = EXCLUDED.bot_user_id,
             signing_secret_reference = EXCLUDED.signing_secret_reference,bot_token_reference = EXCLUDED.bot_token_reference,
             history_token_reference = EXCLUDED.history_token_reference,api_origin = EXCLUDED.api_origin,updated_at = now(),deleted_at = NULL
           WHERE mechane.slack_installations.workspace_id = EXCLUDED.workspace_id RETURNING id`,
          [
            input.installation.id,
            input.workspaceId,
            input.installation.teamId,
            input.installation.botUserId,
            input.installation.signingSecretReference,
            input.installation.botTokenReference,
            input.installation.historyTokenReference,
            input.installation.apiOrigin,
          ],
        );

        if (result.rows.length === 0) {
          return { _tag: 'Conflicting' };
        }

        if (
          existing !== null &&
          (existing.teamId !== input.installation.teamId || existing.botUserId !== input.installation.botUserId)
        ) {
          await disableInstallationBindings(transaction, input.workspaceId, input.installation.id);
        }

        const saved = await installations.getSlackInstallation({
          workspaceId: input.workspaceId,
          installationId: input.installation.id,
        });

        if (saved === null) {
          throw new Error('Slack installation write returned no installation');
        }

        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'slack.installation-configured',
          targetId: saved.id,
        });

        return { _tag: 'Configured', installation: saved };
      });
    },
    async deleteSlackInstallation(input: InstallationDelete): Promise<void> {
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });
        await transaction.client.query(
          'UPDATE mechane.slack_installations SET deleted_at = now(),updated_at = now() WHERE workspace_id = $1 AND id = $2',
          [input.workspaceId, input.installationId],
        );
        await disableInstallationBindings(transaction, input.workspaceId, input.installationId);
        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'slack.installation-deleted',
          targetId: input.installationId,
        });
      });
    },
    async configureSlackBinding(input: BindingWrite): Promise<BindingResult> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });
        await requireWorkspaceMech({
          context: transaction,
          workspaceId: input.workspaceId,
          mechId: input.binding.mechId,
        });

        const installations = createInstallationStore(transaction);

        const installation = await installations.getSlackInstallation({
          workspaceId: input.workspaceId,
          installationId: input.binding.installationId,
        });

        if (installation === null || installation.teamId !== input.binding.teamId) {
          return { _tag: 'ConnectionMissing' };
        }

        const bindings = createBindingStore(transaction);
        const existing = await bindings.getSlackBinding({ bindingId: input.binding.id });

        if (existing !== null && !sameBindingAudience(existing, input.workspaceId, input.binding)) {
          return { _tag: 'Conflicting' };
        }

        const channelBinding = await bindings.findSlackBinding({
          installationId: input.binding.installationId,
          channelId: input.binding.channelId,
        });

        if (channelBinding !== null && channelBinding.id !== input.binding.id) {
          return { _tag: 'Conflicting' };
        }

        await transaction.client.query(
          `INSERT INTO mechane.slack_bindings(id,workspace_id,installation_id,team_id,channel_id,channel_kind,mech_id,is_listening,is_reply_enabled,allowed_user_ids)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT(id) DO UPDATE SET is_listening = EXCLUDED.is_listening,is_reply_enabled = EXCLUDED.is_reply_enabled,
             allowed_user_ids = COALESCE(EXCLUDED.allowed_user_ids,mechane.slack_bindings.allowed_user_ids)`,
          [
            input.binding.id,
            input.workspaceId,
            input.binding.installationId,
            input.binding.teamId,
            input.binding.channelId,
            input.binding.channelKind,
            input.binding.mechId,
            input.binding.isListening,
            input.binding.isReplyEnabled,
            input.binding.allowedUserIds,
          ],
        );

        const saved = await bindings.getSlackBinding({ bindingId: input.binding.id, workspaceId: input.workspaceId });

        if (saved === null) {
          throw new Error('Slack binding write returned no binding');
        }

        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'slack.binding-configured',
          targetId: saved.id,
        });

        return { _tag: 'Configured', binding: saved };
      });
    },
  };
}

function sameInstallation(left: SlackInstallation, right: InstallationConfiguration): boolean {
  const hasSameIdentity =
    left.id === right.id && left.workspaceId === right.workspaceId && left.teamId === right.teamId;

  const hasSameBot = left.botUserId === right.botUserId && left.apiOrigin === right.apiOrigin;

  const hasSameCredentials =
    left.signingSecretReference === right.signingSecretReference &&
    left.botTokenReference === right.botTokenReference &&
    left.historyTokenReference === right.historyTokenReference;

  return hasSameIdentity && hasSameBot && hasSameCredentials;
}

function sameBindingAudience(left: SlackBinding, workspaceId: string, right: BindingConfiguration): boolean {
  const hasSameMech = left.workspaceId === workspaceId && left.mechId === right.mechId;

  const hasSameChannel =
    left.teamId === right.teamId && left.channelId === right.channelId && left.channelKind === right.channelKind;

  return hasSameMech && hasSameChannel && left.installationId === right.installationId;
}

async function disableInstallationBindings(
  context: StoreContext,
  workspaceId: string,
  installationId: string,
): Promise<void> {
  await context.client.query(
    'UPDATE mechane.slack_bindings SET is_listening = false,is_reply_enabled = false WHERE workspace_id = $1 AND installation_id = $2',
    [workspaceId, installationId],
  );
}
