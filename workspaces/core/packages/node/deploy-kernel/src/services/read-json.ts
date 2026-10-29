import { StepSubject } from '@mechane/program';
import { Effect, Redacted, Schema } from 'effect';
import { DeployFailed } from '../errors.ts';
import { fetchAnswer } from './fetch-answer.ts';
import type { ReadJsonInput } from './types.ts';

/**
 * Reads a JSON answer of an API that takes a bearer token, such as Cloudflare's or OpenRouter's, and decodes its body.
 * An answer that is not a success fails with its status and body, and no failure names the token.
 */
export function readJson<S extends Schema.Codec<unknown, unknown>>({
  url,
  init,
  token,
  schema,
  step,
}: ReadJsonInput<S>): Effect.Effect<S['Type'], DeployFailed> {
  const headers = new Headers(init.headers);
  const subjects = [StepSubject.cases.Url.make({ url })];

  headers.set('authorization', `Bearer ${Redacted.value(token)}`);

  return fetchAnswer({ url, init: { ...init, headers }, step, read: (response) => response.text() }).pipe(
    Effect.filterOrFail(
      ({ isOk }) => isOk,
      ({ status, body }) => new DeployFailed({ step, subjects, reason: `it answered ${status}: ${body}` }),
    ),
    Effect.flatMap(({ body }) =>
      Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(body).pipe(
        Effect.mapError((error) => new DeployFailed({ step, subjects, reason: error.message })),
      ),
    ),
  );
}
