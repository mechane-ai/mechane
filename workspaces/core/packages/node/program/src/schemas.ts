import { Effect, Schema } from 'effect';

/** A GitHub login as GitHub allows one: letters, digits and hyphens, at most 39 of them. */
export const GitHubLogin = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9-]{1,39}$/));

export type GitHubLogin = typeof GitHubLogin.Type;

/** A lock: each kind of shipped name, or each store's schema steps, by key, as the entries it holds. */
export const Lock = Schema.Record(Schema.String, Schema.Array(Schema.String));

export type Lock = typeof Lock.Type;

/**
 * What a failed step of a program acted on, which its diagnostic names after the step. It is a file or folder, a URL, a
 * command's arguments, a git revision, a release, a compile target, a release tag, a Worker version, or a bucket's
 * object.
 */
export const StepSubject = Schema.TaggedUnion({
  Path: { path: Schema.String },
  Url: { url: Schema.URL },
  Command: { args: Schema.Array(Schema.String) },
  Revision: { revision: Schema.String },
  Release: { release: Schema.String },
  Target: { target: Schema.String },
  Tag: { tag: Schema.String },
  Version: { version: Schema.String },
  BucketObject: { bucket: Schema.String, key: Schema.String },
});

export type StepSubject = typeof StepSubject.Type;

/**
 * The subjects of a program's failed step, in the order its diagnostic names them; none unless the code that builds the
 * failure names any.
 */
export const StepSubjects = Schema.Array(StepSubject).pipe(Schema.withConstructorDefault(Effect.succeed([])));

export type StepSubjects = typeof StepSubjects.Type;
