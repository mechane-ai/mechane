import type { SlackInstallation } from '@mechane/deployment';
import type { SlackDeliveryId, SlackDestination } from '@mechane/records';
import type { DateTime, Option, Redacted } from 'effect';

export type SlackClientInput = { readonly installation: SlackInstallation; readonly token: Redacted.Redacted };

export type ReconcileSlackDeliveryInput = SlackClientInput & {
  readonly deliveryId: SlackDeliveryId;
  readonly destination: SlackDestination;
  readonly contentSha256: string;
  readonly attemptedAt: DateTime.Utc;
};

/** Positive history evidence or a reason the write remains uncertain. */
export type SlackReconciliation = {
  /** Absent until a provider response or history confirms the write. */
  readonly messageTimestamp: Option.Option<string>;
  readonly reason: string;
};

export type SlackHistoryPageInput = ReconcileSlackDeliveryInput & { readonly cursor: string };
