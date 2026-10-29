import { Schema } from 'effect';

/** An installation credential plus the repository and permission evidence needed to constrain it. */
export const GitHubToken = Schema.Struct({
  token: Schema.RedactedFromValue(Schema.NonEmptyString),
  expires_at: Schema.DateTimeUtcFromString,
  repositories: Schema.Array(Schema.Struct({ id: Schema.Int })),
  permissions: Schema.Record(Schema.String, Schema.String),
});

export type GitHubToken = typeof GitHubToken.Type;
