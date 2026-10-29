import type { SlackInstallation } from '@mechane/deployment';
import type { MechRow, MechStore, SlackDeliveryRow } from '@mechane/mech-store';
import type { SlackDestination } from '@mechane/records';
import type { ObjectSettings } from '@mechane/rpc';
import type { Redacted } from 'effect';

export type RunSlackDeliveriesInput = { readonly store: MechStore; readonly settings: ObjectSettings };

export type RunSlackDeliveryInput = RunSlackDeliveriesInput & {
  readonly mech: MechRow;
  readonly delivery: SlackDeliveryRow;
};

/** A frozen audience and server-only credentials ready for transport. */
export type PreparedSlackDelivery = {
  readonly installation: SlackInstallation;
  readonly destination: SlackDestination;
  readonly botToken: Redacted.Redacted;
  readonly historyToken: Redacted.Redacted;
};
