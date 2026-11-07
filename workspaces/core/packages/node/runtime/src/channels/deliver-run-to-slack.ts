import type { PresentationSpecification } from '@mechane/protocol/presentation';
import type { SlackDelivery } from '../domain.ts';
import type { RunOutcome } from '../execution/types.ts';
import type { DeliveryResult } from './deliver-slack-delivery.ts';
import { deliverSlackOutput } from './deliver-slack-output.ts';

type DeliverRunInput = {
  readonly runId: string;
  readonly kind: 'acknowledgement' | 'answer' | 'failure';
  readonly text?: string;
  readonly spec?: PresentationSpecification;
};

const DELIVERY_MAX_ATTEMPTS = 8;

export async function deliverRunToSlack(input: DeliverRunInput): Promise<DeliveryResult> {
  'use step';

  return await deliverSlackOutput({ ...input, key: input.kind, kind: deliveryKind(input.kind) });
}

deliverRunToSlack.maxRetries = DELIVERY_MAX_ATTEMPTS;

export async function deliverRunOutcomeToSlack(outcome: RunOutcome): Promise<DeliveryResult> {
  if (outcome.status !== 'completed') {
    return await deliverRunToSlack({ runId: outcome.runId, kind: 'failure', text: outcome.error });
  }

  if (outcome.presentation !== null) {
    return await deliverRunToSlack({
      runId: outcome.runId,
      kind: 'answer',
      text: outcome.reply,
      spec: outcome.presentation.spec,
    });
  }

  return await deliverRunToSlack({ runId: outcome.runId, kind: 'answer', text: outcome.reply });
}

function deliveryKind(kind: DeliverRunInput['kind']): SlackDelivery['kind'] {
  switch (kind) {
    case 'acknowledgement':
      return 'acknowledgement';
    case 'answer':
      return 'reply';
    case 'failure':
      return 'notification';
  }
}
