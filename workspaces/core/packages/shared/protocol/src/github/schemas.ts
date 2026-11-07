import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** An OAuth error GitHub reports in place of a code or a token, such as `access_denied`. */
const GitHubErrorCode = Schema.String;

/** GitHub's answer to the exchange, which reports a refused code with status 200 and an `error` field. */
export const GitHubTokenAnswer = Schema.Union([
  wireStruct({ fields: { accessToken: Schema.RedactedFromValue(Schema.String) } }),
  Schema.Struct({ error: GitHubErrorCode }),
]);

export type GitHubTokenAnswer = typeof GitHubTokenAnswer.Type;

/** The signed-in user; `id` is GitHub's stable numeric id, and `login` a name its owner may change. */
export const GitHubUser = Schema.Struct({ id: Schema.Int, login: Schema.String });

export type GitHubUser = typeof GitHubUser.Type;
