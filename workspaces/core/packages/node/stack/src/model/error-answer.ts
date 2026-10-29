import { HttpHeader, MediaType } from '@mechane/records';
import type { HttpStatusCode } from '@mechane/records';
import type { ModelAnswer } from './types.ts';

type ErrorAnswerInput = { readonly status: HttpStatusCode; readonly message: string };

/** An error answer of the scripted upstream, in an OpenAI-compatible body, which answers no request with a reply. */
export function errorAnswer({ status, message }: ErrorAnswerInput): ModelAnswer {
  return {
    status,
    headers: { [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({ error: { message } }),
    answered: [],
  };
}
