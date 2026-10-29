import { StepSubjects } from '@mechane/program';
import { Schema } from 'effect';
import { ReleaseStep } from './constants.ts';

/**
 * A step of building or uploading a release failed: `step` names it, `subjects` what it acted on, and `reason` says
 * why.
 */
export class ReleaseFailed extends Schema.TaggedError<ReleaseFailed>()('ReleaseFailed', {
  step: Schema.Enum(ReleaseStep),
  subjects: StepSubjects,
  reason: Schema.String,
}) {}
