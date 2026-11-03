import { BoundedRequestRecordId } from '@mechane/records';
import { Schema } from 'effect';

/** The admitted mech retains no bounded submission with this request identity. */
export class BoundedTurnNotFound extends Schema.TaggedError<BoundedTurnNotFound>()('BoundedTurnNotFound', {
  requestId: BoundedRequestRecordId,
}) {}

/** The request identity already names a submission with different text or limits. */
export class BoundedTurnConflict extends Schema.TaggedError<BoundedTurnConflict>()('BoundedTurnConflict', {
  requestId: BoundedRequestRecordId,
}) {}
