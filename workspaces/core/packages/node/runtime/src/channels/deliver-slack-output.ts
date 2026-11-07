import type { PresentationSpecification } from '@mechane/protocol/presentation';
import { createHash } from 'node:crypto';
import { FatalError } from 'workflow';
import type { Run, SlackDelivery } from '../domain.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { deliverSlackDelivery } from './deliver-slack-delivery.ts';
import type { DeliveryResult } from './deliver-slack-delivery.ts';
import type { DeliveryContent } from './delivery-content.ts';
import { channelRecordId } from './identity.ts';

export type DeliverSlackOutputInput = {
  readonly runId: string;
  readonly kind: SlackDelivery['kind'];
  readonly key: string;
  readonly text?: string;
  readonly spec?: PresentationSpecification;
};

export async function deliverSlackOutput(input: DeliverSlackOutputInput): Promise<DeliveryResult> {
  return await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId: input.runId });

    if (run === null) {
      throw new FatalError('Slack delivery run is unavailable');
    }

    if (run.origin.kind !== 'slack') {
      return { status: 'not-slack' };
    }

    const content = deliveryContent(input, run);
    const contentDigest = createHash('sha256').update(JSON.stringify(content)).digest('hex');

    const delivery = await store.prepareSlackDelivery({
      id: channelRecordId(`slack:${run.id}:${input.key}`),
      workspaceId: run.workspaceId,
      mechId: run.mechId,
      runId: run.id,
      bindingId: run.origin.bindingId,
      channelId: run.origin.channelId,
      threadId: run.origin.threadId,
      kind: input.kind,
      content,
      contentDigest,
    });

    return await deliverSlackDelivery({ store, delivery, origin: run.origin, purpose: 'output' });
  });
}

function deliveryContent(input: DeliverSlackOutputInput, run: Run): DeliveryContent {
  if (input.kind === 'acknowledgement') {
    return { text: 'Working on it.' };
  }

  const recordedText = run.reply ?? run.error;

  const text =
    input.text ??
    recordedText ??
    'This task stopped before producing a response. Open the run in Mechane for its status.';

  if (input.spec === undefined) {
    return { text };
  }

  return { text, spec: input.spec };
}
