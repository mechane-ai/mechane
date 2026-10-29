import { Schema } from 'effect';
import { LauncherStep } from './constants.ts';

/**
 * The host launcher refused a machine's start or stop at its URL with another status than success, such as a 401 for a
 * key the stack did not draw. Its status is the launcher's own answer, which no closed set bounds, so it is a measured
 * value.
 */
export class LauncherRefused extends Schema.TaggedError<LauncherRefused>()('LauncherRefused', {
  url: Schema.URL,
  step: Schema.Enum(LauncherStep),
  status: Schema.Int,
  reason: Schema.String,
}) {}
