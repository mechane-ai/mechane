import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { Option } from 'effect';
import type { ServedAnswer } from '../types.ts';
import { jsonAnswer } from './json-answer.ts';
import { registeredQuery } from './registered-query.ts';
import type { RouteInput } from './types.ts';

/** The authorization page, reduced to one field with the default login and one button; it posts to itself. */
export function signInPage({ request, github }: RouteInput): ServedAnswer {
  if (Option.isNone(registeredQuery({ request, github }))) {
    return jsonAnswer({ status: HttpStatusCode.BadRequest, body: { error: 'redirect_uri_mismatch' } });
  }

  const body = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sign in to the local GitHub</title></head>',
    '<body><form method="post"><label>Sign in to Mechane as the GitHub login',
    `<input name="login" value="${github.login}" required></label>`,
    '<button type="submit">Sign in</button></form></body></html>',
  ].join('\n');

  return { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.Html }, body };
}
