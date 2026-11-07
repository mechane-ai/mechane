import { z } from 'zod';
import type { SlackDelivery } from '../../domain.ts';
import type { StoreContext } from '../context.ts';

const DeliveryRow = z.object({
  id: z.string(),
  workspaceId: z.string(),
  mechId: z.string(),
  runId: z.string().nullable(),
  bindingId: z.string(),
  channelId: z.string(),
  threadId: z.string(),
  kind: z.enum(['acknowledgement', 'reply', 'notification']),
  status: z.enum(['pending', 'sending', 'delivered', 'failed', 'uncertain', 'blocked']),
  messageId: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
  contentDigest: z.string(),
  lastError: z.string().nullable(),
  createdAt: z.coerce.date().transform((value) => value.toISOString()),
  updatedAt: z.coerce.date().transform((value) => value.toISOString()),
});

const DELIVERIES_DEFAULT_ITEMS = 100;

type PrepareDelivery = Pick<
  SlackDelivery,
  | 'id'
  | 'workspaceId'
  | 'mechId'
  | 'runId'
  | 'bindingId'
  | 'channelId'
  | 'threadId'
  | 'kind'
  | 'content'
  | 'contentDigest'
>;

type DeliveryIdentity = { readonly deliveryId: string };
type CompleteDelivery = DeliveryIdentity & { readonly messageId: string };

type FailDelivery = DeliveryIdentity & {
  readonly status: 'failed' | 'uncertain' | 'blocked' | 'pending';
  readonly reason: string;
};

type ListDeliveries = { readonly workspaceId: string; readonly mechId: string; readonly maximumItems?: number };

export type DeliveryStore = {
  readonly prepareSlackDelivery: (input: PrepareDelivery) => Promise<SlackDelivery>;
  readonly claimSlackDelivery: (input: DeliveryIdentity) => Promise<boolean>;
  readonly getSlackDelivery: (input: DeliveryIdentity) => Promise<SlackDelivery | null>;
  readonly completeSlackDelivery: (input: CompleteDelivery) => Promise<void>;
  readonly failSlackDelivery: (input: FailDelivery) => Promise<void>;
  readonly listSlackDeliveries: (input: ListDeliveries) => Promise<ReadonlyArray<SlackDelivery>>;
};

export function createDeliveryStore(context: StoreContext): DeliveryStore {
  return {
    async prepareSlackDelivery(input: PrepareDelivery): Promise<SlackDelivery> {
      const result = await context.client.query(
        `INSERT INTO mechane.slack_deliveries
        (id,workspace_id,mech_id,run_id,binding_id,channel_id,thread_id,kind,status,content,content_digest)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9::jsonb,$10)
        ON CONFLICT(id) DO UPDATE SET id=EXCLUDED.id
        WHERE mechane.slack_deliveries.content_digest=EXCLUDED.content_digest
          AND mechane.slack_deliveries.binding_id=EXCLUDED.binding_id
          AND mechane.slack_deliveries.run_id IS NOT DISTINCT FROM EXCLUDED.run_id
        RETURNING id,workspace_id AS "workspaceId",mech_id AS "mechId",run_id AS "runId",binding_id AS "bindingId",
  channel_id AS "channelId",thread_id AS "threadId",kind,status,message_id AS "messageId",content,
  content_digest AS "contentDigest",last_error AS "lastError",created_at AS "createdAt",updated_at AS "updatedAt"`,
        [
          input.id,
          input.workspaceId,
          input.mechId,
          input.runId,
          input.bindingId,
          input.channelId,
          input.threadId,
          input.kind,
          JSON.stringify(input.content),
          input.contentDigest,
        ],
      );

      if (result.rowCount === 0) {
        throw new Error('Slack delivery identity conflicts with its recorded content');
      }

      return DeliveryRow.parse(result.rows[0]);
    },
    async claimSlackDelivery({ deliveryId }: DeliveryIdentity): Promise<boolean> {
      const result = await context.client.query(
        `UPDATE mechane.slack_deliveries SET status='sending',updated_at=now()
        WHERE id=$1 AND status='pending' RETURNING id`,
        [deliveryId],
      );

      return result.rowCount === 1;
    },
    async getSlackDelivery({ deliveryId }: DeliveryIdentity): Promise<SlackDelivery | null> {
      const result = await context.client.query(
        `SELECT id,workspace_id AS "workspaceId",mech_id AS "mechId",run_id AS "runId",binding_id AS "bindingId",
  channel_id AS "channelId",thread_id AS "threadId",kind,status,message_id AS "messageId",content,
  content_digest AS "contentDigest",last_error AS "lastError",created_at AS "createdAt",updated_at AS "updatedAt" FROM mechane.slack_deliveries WHERE id=$1`,
        [deliveryId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return DeliveryRow.parse(result.rows[0]);
    },
    async completeSlackDelivery({ deliveryId, messageId }: CompleteDelivery): Promise<void> {
      await context.client.query(
        `UPDATE mechane.slack_deliveries
        SET status='delivered',message_id=$2,last_error=NULL,updated_at=now() WHERE id=$1`,
        [deliveryId, messageId],
      );
    },
    async failSlackDelivery({ deliveryId, status, reason }: FailDelivery): Promise<void> {
      await context.client.query(
        `UPDATE mechane.slack_deliveries SET status=$2,last_error=$3,updated_at=now()
        WHERE id=$1 AND status<>'delivered'`,
        [deliveryId, status, reason],
      );
    },
    async listSlackDeliveries({
      workspaceId,
      mechId,
      maximumItems = DELIVERIES_DEFAULT_ITEMS,
    }: ListDeliveries): Promise<ReadonlyArray<SlackDelivery>> {
      const result = await context.client.query(
        `SELECT id,workspace_id AS "workspaceId",mech_id AS "mechId",run_id AS "runId",binding_id AS "bindingId",
  channel_id AS "channelId",thread_id AS "threadId",kind,status,message_id AS "messageId",content,
  content_digest AS "contentDigest",last_error AS "lastError",created_at AS "createdAt",updated_at AS "updatedAt" FROM mechane.slack_deliveries
        WHERE workspace_id=$1 AND mech_id=$2 ORDER BY created_at DESC,id DESC LIMIT $3`,
        [workspaceId, mechId, maximumItems],
      );

      return z.array(DeliveryRow).parse(result.rows);
    },
  };
}
