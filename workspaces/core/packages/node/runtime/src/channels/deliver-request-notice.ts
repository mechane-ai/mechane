import type { DeliveryResult } from './deliver-slack-delivery.ts';
import { deliverSlackOutput } from './deliver-slack-output.ts';

type DeliverRequestNoticeInput = { readonly runId: string; readonly requestId: string; readonly text: string };
const DELIVERY_MAX_ATTEMPTS = 8;

export async function deliverRequestNotice({
  runId,
  requestId,
  text,
}: DeliverRequestNoticeInput): Promise<DeliveryResult> {
  'use step';

  return await deliverSlackOutput({ runId, key: `request:${requestId}`, kind: 'notification', text });
}

deliverRequestNotice.maxRetries = DELIVERY_MAX_ATTEMPTS;
