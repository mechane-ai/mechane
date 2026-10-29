import { StepSubjects } from '@mechane/program';
import { Schema } from 'effect';
import { DeployStep } from './constants.ts';

/**
 * A step or a check of rendering, deploying, rolling back or smoking production failed. Its `step` names it, and its
 * `subjects` what it acted on. Its `reason` says why, never with a credential's value.
 */
export class DeployFailed extends Schema.TaggedError<DeployFailed>()('DeployFailed', {
  step: Schema.Enum(DeployStep),
  subjects: StepSubjects,
  reason: Schema.String,
}) {}
