import { Effect, Option, Ref } from 'effect';
import type { ServerExited } from '../errors.ts';
import type { ServerMessage } from '../schemas.ts';
import { answeredMessage } from './answered-message.ts';
import type { RequestInput } from './types.ts';
import { writeMessage } from './write-message.ts';

/** A request the server answered with its result. */
type RequestResult = { readonly result: unknown };

/** A request the server refused, with its message. */
type RequestRefusal = { readonly refusal: string };

/** What the server answered a request. */
type RequestAnswer = RequestResult | RequestRefusal;

/** The server's answer to a request. */
type RequestAnswerInput = { readonly message: ServerMessage };

/** Sends one request and waits for its answer: its result, or the refusal the server gave instead. */
export const request = Effect.fn('request')(function* ({
  server,
  method,
  params,
}: RequestInput): Effect.fn.Return<RequestAnswer, ServerExited> {
  const id = yield* Ref.getAndUpdate(server.ids, (next) => next + 1);

  writeMessage({ child: server.child, message: { jsonrpc: '2.0', id, method, params } });

  const message = yield* answeredMessage({ server, id });

  return requestAnswer({ message });
});

/** What an answer says: the refusal its error gives, or else its result. */
function requestAnswer({ message }: RequestAnswerInput): RequestAnswer {
  if (Option.isSome(message.error)) {
    return { refusal: message.error.value.message };
  }

  return { result: message.result };
}
