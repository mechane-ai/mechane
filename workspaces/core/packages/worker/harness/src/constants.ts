import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Duration } from 'effect';

/** Why a turn ended without a reply, in Mechane's terms: its model failed, or its own work faulted. */
export const TurnFailure = { Model: 'model', Fault: 'fault' } as const;

export type TurnFailure = (typeof TurnFailure)[keyof typeof TurnFailure];

/** The provider id under which every mech's conversation names its model; pi stores it, so it is a stored format. */
export const MODEL_PROVIDER = 'mechane';

/** Identifies inbox boundaries when reading one request's tool evidence from pi's transcript. */
export const INBOX_ITEM_ENTRY_KIND = 'mechane.inbox_item';

/** Leaves room for pi's entry and document metadata below Cloudflare SQLite's 2 MB row limit. */
export const INBOX_SUBMISSION_MAX_BYTES = 1024 * BYTES_PER_KIBIBYTE;

/** Caps one live stream even when a bounded request's absolute deadline is much later. */
export const DISPATCH_DEADLINE = Duration.minutes(5);
