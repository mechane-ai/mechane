import { CreationRequestRecordId, MechId } from '@mechane/records';
import { Schema } from 'effect';

/** Another definition revision was saved before the caller's requested update. */
export class MechRevisionConflict extends Schema.TaggedError<MechRevisionConflict>()('MechRevisionConflict', {
  mechId: MechId,
  expectedRevision: Schema.Int,
  currentRevision: Schema.Int,
}) {}

/** The creation request ID is already retained with different inputs. */
export class MechCreationConflict extends Schema.TaggedError<MechCreationConflict>()('MechCreationConflict', {
  requestId: CreationRequestRecordId,
}) {}

/** The mech retains its history but no longer admits incoming work. */
export class MechArchived extends Schema.TaggedError<MechArchived>()('MechArchived', { mechId: MechId }) {}
