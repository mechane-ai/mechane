import { StepSubjects } from '@mechane/program';
import { Schema } from 'effect';
import { DistributionStep } from './constants.ts';

/** A failed artifact operation, with its boundary error retained as the reason. */
export class DistributionFailed extends Schema.TaggedError<DistributionFailed>()('DistributionFailed', {
  step: Schema.Enum(DistributionStep),
  subjects: StepSubjects,
  reason: Schema.String,
}) {}
