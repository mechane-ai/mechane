import { z } from 'zod';
import type { SlackBinding, SlackOrigin } from '../../domain.ts';
import type { StoreContext } from '../context.ts';

const BindingRow = z.object({
  id: z.string(),
  workspaceId: z.string(),
  installationId: z.string(),
  teamId: z.string(),
  channelId: z.string(),
  channelKind: z.enum(['channel', 'im', 'mpim']),
  mechId: z.string(),
  isListening: z.boolean(),
  isReplyEnabled: z.boolean(),
  allowedUserIds: z.array(z.string()).nullable(),
});

type BindingQuery = { readonly bindingId: string; readonly workspaceId?: string };
type FindBinding = { readonly installationId: string; readonly channelId: string };
type ListBindings = { readonly workspaceId: string; readonly mechId?: string };

type DeliveryAuthority = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly origin: SlackOrigin;
  readonly purpose?: 'output' | 'refusal';
};

export type BindingStore = {
  readonly isSlackDeliveryAllowed: (input: DeliveryAuthority) => Promise<boolean>;
  readonly getSlackBinding: (input: BindingQuery) => Promise<SlackBinding | null>;
  readonly findSlackBinding: (input: FindBinding) => Promise<SlackBinding | null>;
  readonly listSlackBindings: (input: ListBindings) => Promise<ReadonlyArray<SlackBinding>>;
};

export function createBindingStore(context: StoreContext): BindingStore {
  return {
    async isSlackDeliveryAllowed({
      workspaceId,
      mechId,
      origin,
      purpose = 'output',
    }: DeliveryAuthority): Promise<boolean> {
      const result = await context.client.query(
        `SELECT binding.id FROM mechane.slack_bindings binding
        JOIN mechane.slack_installations installation ON installation.id=binding.installation_id AND installation.workspace_id=binding.workspace_id
        JOIN mechane.workspaces workspace ON workspace.id=binding.workspace_id
        WHERE binding.id=$1 AND binding.workspace_id=$2 AND binding.mech_id=$3 AND binding.installation_id=$4
          AND binding.team_id=$5 AND installation.team_id=$5 AND binding.channel_id=$6
          AND binding.is_listening AND binding.is_reply_enabled AND installation.deleted_at IS NULL
          AND (binding.allowed_user_ids IS NULL OR $7=ANY(binding.allowed_user_ids))
          AND ($8='refusal' OR NOT COALESCE((workspace.policy->>'isSuspended')::boolean,false))`,
        [
          origin.bindingId,
          workspaceId,
          mechId,
          origin.installationId,
          origin.teamId,
          origin.channelId,
          origin.userId,
          purpose,
        ],
      );

      return result.rowCount === 1;
    },
    async getSlackBinding({ bindingId, workspaceId }: BindingQuery): Promise<SlackBinding | null> {
      const result = await context.client.query(
        `SELECT id,workspace_id AS "workspaceId",installation_id AS "installationId",team_id AS "teamId",
  channel_id AS "channelId",channel_kind AS "channelKind",mech_id AS "mechId",is_listening AS "isListening",
  is_reply_enabled AS "isReplyEnabled",allowed_user_ids AS "allowedUserIds" FROM mechane.slack_bindings
        WHERE id=$1 AND ($2::uuid IS NULL OR workspace_id=$2)`,
        [bindingId, workspaceId ?? null],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return BindingRow.parse(result.rows[0]);
    },
    async findSlackBinding({ installationId, channelId }: FindBinding): Promise<SlackBinding | null> {
      const result = await context.client.query(
        `SELECT id,workspace_id AS "workspaceId",installation_id AS "installationId",team_id AS "teamId",
  channel_id AS "channelId",channel_kind AS "channelKind",mech_id AS "mechId",is_listening AS "isListening",
  is_reply_enabled AS "isReplyEnabled",allowed_user_ids AS "allowedUserIds" FROM mechane.slack_bindings
        WHERE installation_id=$1 AND channel_id=$2`,
        [installationId, channelId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return BindingRow.parse(result.rows[0]);
    },
    async listSlackBindings({ workspaceId, mechId }: ListBindings): Promise<ReadonlyArray<SlackBinding>> {
      const result = await context.client.query(
        `SELECT id,workspace_id AS "workspaceId",installation_id AS "installationId",team_id AS "teamId",
  channel_id AS "channelId",channel_kind AS "channelKind",mech_id AS "mechId",is_listening AS "isListening",
  is_reply_enabled AS "isReplyEnabled",allowed_user_ids AS "allowedUserIds" FROM mechane.slack_bindings
        WHERE workspace_id=$1 AND ($2::uuid IS NULL OR mech_id=$2) ORDER BY id`,
        [workspaceId, mechId ?? null],
      );

      return z.array(BindingRow).parse(result.rows);
    },
  };
}
