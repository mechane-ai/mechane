import type { WatchConfiguration, WatchStatus } from '@mechane/protocol';
import type { RecordId, WatchId } from '@mechane/records';

export type WatchInput = { readonly watchId: typeof WatchId.Encoded };

export type SetWatchInput = WatchInput & {
  readonly configuration: typeof WatchConfiguration.Encoded;
  readonly creatorId: RecordId;
};

export type UpdateWatchStatusInput = WatchInput & { readonly status: WatchStatus };
