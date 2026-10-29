import type { ServerResponse } from 'node:http';
import type { ServedAnswer } from './types.ts';

type RespondInput = { readonly response: ServerResponse; readonly answer: ServedAnswer };

/** Writes the answer; a caller that went away meanwhile misses it, and the execution runs on. */
export function respond({ response, answer }: RespondInput): void {
  response.writeHead(answer.status, answer.headers).end(answer.body);
}
