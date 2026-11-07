import type { InputAdmission, SlackDelivery, SlackOrigin } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { AdmissionRefused, StoreConflict } from '../errors.ts';
import { createAdmissionStore } from '../execution/admissions.ts';
import type { AdmitInput } from '../execution/admissions.ts';
import { createDeliveryStore } from './deliveries.ts';

type SlackAdmissionInput = {
  readonly input: AdmitInput & { readonly origin: SlackOrigin };
  readonly refusal: Pick<SlackDelivery, 'id' | 'content' | 'contentDigest'>;
};

type SlackAdmission =
  | { readonly status: 'admitted'; readonly admission: InputAdmission }
  | { readonly status: 'refused'; readonly delivery: SlackDelivery };

export function createSlackAdmissionStore(context: StoreContext) {
  return {
    async admitSlackInput({ input, refusal }: SlackAdmissionInput): Promise<SlackAdmission> {
      return await context.atomic(async (transaction) => {
        await transaction.client.query('SELECT id FROM mechane.workspaces WHERE id=$1 FOR UPDATE', [input.workspaceId]);

        const deliveries = createDeliveryStore(transaction);
        const prior = await deliveries.getSlackDelivery({ deliveryId: refusal.id });

        if (prior !== null) {
          const hasSameMech = prior.workspaceId === input.workspaceId && prior.mechId === input.mechId;

          const hasSameDestination =
            prior.bindingId === input.origin.bindingId &&
            prior.channelId === input.origin.channelId &&
            prior.threadId === input.origin.threadId;

          const isRefusal = prior.runId === null && prior.kind === 'notification';

          if (!hasSameMech || !hasSameDestination || !isRefusal) {
            throw new StoreConflict('Slack refusal identity changed');
          }

          return { status: 'refused', delivery: prior };
        }

        try {
          const admission = await createAdmissionStore(transaction).admitInput(input);

          return { status: 'admitted', admission };
        } catch (error) {
          if (!(error instanceof AdmissionRefused)) {
            throw error;
          }

          const delivery = await deliveries.prepareSlackDelivery({
            ...refusal,
            workspaceId: input.workspaceId,
            mechId: input.mechId,
            runId: null,
            bindingId: input.origin.bindingId,
            channelId: input.origin.channelId,
            threadId: input.origin.threadId,
            kind: 'notification',
          });

          return { status: 'refused', delivery };
        }
      });
    },
  };
}
