import { Effect, Option, Queue } from 'effect';
import type { ServerExited } from '../errors.ts';
import type { ServerMessage } from '../schemas.ts';
import type { LanguageServer } from '../types.ts';
import { writeMessage } from './write-message.ts';

/** The language server, and the id of the request that waits. */
type AnsweredMessageInput = { readonly server: LanguageServer; readonly id: number };

/** The language server, and a message it wrote. */
type AnswerServerRequestInput = { readonly server: LanguageServer; readonly message: ServerMessage };

/** Takes the server's messages until the answer to the request, answering each request the server makes meanwhile. */
export const answeredMessage = Effect.fn('answeredMessage')(function* ({
  server,
  id,
}: AnsweredMessageInput): Effect.fn.Return<ServerMessage, ServerExited> {
  /** Whether the message answers the request: it carries the request's id and no method. */
  const isAnswer: (message: ServerMessage) => boolean = ({ id: answered, method }) =>
    Option.contains(answered, id) && Option.isNone(method);

  let message = yield* Queue.take(server.messages);

  while (!isAnswer(message)) {
    answerServerRequest({ server, message });

    message = yield* Queue.take(server.messages);
  }

  return message;
});

/** Answers a request the server makes of the program with an empty result; a notification needs no answer. */
function answerServerRequest({ server, message }: AnswerServerRequestInput): void {
  if (Option.isSome(message.id) && Option.isSome(message.method)) {
    writeMessage({ child: server.child, message: { jsonrpc: '2.0', id: message.id.value, result: null } });
  }
}
