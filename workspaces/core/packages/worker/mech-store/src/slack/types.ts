import type { SlackDeliveryId, SlackDeliveryStatus } from '@mechane/records';
import type { DateTime, Option } from 'effect';

export type UpdateSlackDeliveryInput = {
  readonly deliveryId: SlackDeliveryId;
  readonly status: SlackDeliveryStatus;
  /** Absent after settlement or when automated recovery has stopped. */
  readonly nextAttemptAt: Option.Option<DateTime.Utc>;
  /** Absent until a provider response or history confirms the write. */
  readonly messageTimestamp: Option.Option<string>;
  /** Absent when no delivery failure is recorded. */
  readonly lastError: Option.Option<string>;
  readonly reconciliationCount: number;
};
