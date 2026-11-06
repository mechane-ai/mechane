import { ExecutionAccessState } from '@mechane/protocol';
import { Schema } from 'effect';

/** A workspace lookup keeps absent access distinct from a mech outside the workspace. */
export const ExecutionAccessReading = Schema.TaggedUnion({
  Found: { configuration: ExecutionAccessState },
  MechNotFound: {},
});

export type ExecutionAccessReading = typeof ExecutionAccessReading.Type;
