import { SettledReceipt } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

/**
 * What asking a machine about an execution found: settled with the guest's receipt, unsettled while the guest answers
 * that it still runs or the request fails, or lost. A lost machine stopped, or its port reaches another machine's
 * guest.
 */
export const GuestAnswer = Schema.TaggedUnion({ Settled: { receipt: SettledReceipt }, Unsettled: {}, Lost: {} });

export type GuestAnswer = typeof GuestAnswer.Type;
