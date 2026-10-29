import { Schema } from 'effect';
import { GitHubStep, PageRefusal } from './constants.ts';

/** GitHub refused the authorization code, such as one that expired or that another sign-in used. */
export class GitHubRefused extends Schema.TaggedError<GitHubRefused>()('GitHubRefused', { reason: Schema.String }) {}

/** GitHub did not answer a sign-in's call, the one `step` names, in time or in a shape it documents. */
export class GitHubUnavailable extends Schema.TaggedError<GitHubUnavailable>()('GitHubUnavailable', {
  step: Schema.Enum(GitHubStep),
  reason: Schema.String,
}) {}

/** A page refused the browser's request for the reason `refusal` names, which picks the page it answers with. */
export class PageRefused extends Schema.TaggedError<PageRefused>()('PageRefused', {
  refusal: Schema.Enum(PageRefusal),
}) {}
