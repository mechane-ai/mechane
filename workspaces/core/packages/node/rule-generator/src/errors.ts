import { Schema } from 'effect';
import { GenerateStep } from './constants.ts';

/** A step of the generator failed on one file: reading an input, formatting a generated file, or writing it. */
export class GenerateFailed extends Schema.TaggedError<GenerateFailed>()('GenerateFailed', {
  step: Schema.Enum(GenerateStep),
  path: Schema.String,
  reason: Schema.String,
}) {}
