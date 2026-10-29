import { HttpHeader, MediaType } from '@mechane/records';
import type { HttpStatusCode } from '@mechane/records';
import type { ServedAnswer } from '../types.ts';

type JsonAnswerInput = { readonly status: HttpStatusCode; readonly body: unknown };

/** An answer of the local GitHub with a JSON body, as GitHub's API and OAuth endpoints answer. */
export function jsonAnswer({ status, body }: JsonAnswerInput): ServedAnswer {
  return { status, headers: { [HttpHeader.ContentType]: MediaType.Json }, body: JSON.stringify(body) };
}
