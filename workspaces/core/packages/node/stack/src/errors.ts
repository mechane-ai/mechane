import { StepSubjects } from '@mechane/program';
import { Schema } from 'effect';
import { StackStep } from './constants.ts';

/**
 * A step of starting, serving or stopping the local stack failed: `step` names it, `subjects` what it acted on, and
 * `reason` says why.
 */
export class StackFailed extends Schema.TaggedError<StackFailed>()('StackFailed', {
  step: Schema.Enum(StackStep),
  subjects: StepSubjects,
  reason: Schema.String,
}) {}
