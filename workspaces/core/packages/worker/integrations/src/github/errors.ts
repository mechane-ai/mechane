import { Schema } from 'effect';

/** Provider refusals and uncertain outcomes, with no credential or response body. */
export class GitHubFailed extends Schema.TaggedError<GitHubFailed>()('GitHubFailed', {
  status: Schema.Int,
  reason: Schema.String,
}) {}
