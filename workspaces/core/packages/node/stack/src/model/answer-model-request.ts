import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Array, Option, Record, Result, Schema } from 'effect';
import { SCRIPTED_OFFERS } from '../constants.ts';
import type { ServedRequest } from '../types.ts';
import { ChatRole, SCRIPTED_MODEL_KEY, ScriptedPath } from './constants.ts';
import { errorAnswer } from './error-answer.ts';
import { ChatMessage } from './schemas.ts';
import { scriptedReply } from './scripted-reply.ts';
import { streamAnswer } from './stream-answer.ts';
import type { ModelAnswer } from './types.ts';

type AnswerModelRequestInput = { readonly request: ServedRequest };

/**
 * The fields of a chat-completions request body that the scripted upstream reads: its offer, its messages and its end
 * user. Every dispatch names its workspace's UUID as its end user.
 */
const ChatRequest = Schema.fromJsonString(
  Schema.Struct({
    model: Schema.String,
    messages: Schema.Array(ChatMessage),
    user: Schema.String.check(Schema.isUUID()),
  }),
);

type ChatRequest = typeof ChatRequest.Type;

/** The `authorization` header of a request that carries the stack's key. */
const SCRIPTED_AUTHORIZATION = bearerAuthorization({ token: SCRIPTED_MODEL_KEY });

/** The roles of every final message the scripted upstream answers. */
const ANSWERED_ROLES: ReadonlySet<string> = new Set([ChatRole.User, ChatRole.Tool]);

type ScriptedChatInput = { readonly body: string };

/** A request's chat for a scripted offer, and its final message, which the reply answers. */
type ScriptedChat = { readonly chat: ChatRequest; readonly final: ChatMessage };

/**
 * Answers one request as an OpenAI-compatible upstream would. A chat completion for a scripted offer, with the stack's
 * key and a provider session, gets the scripted reply, and every other request an error. Each reply records the
 * request's body as sent, which holds its whole context and its end user.
 */
export function answerModelRequest({ request }: AnswerModelRequestInput): ModelAnswer {
  if (request.method !== HttpMethod.Post || request.url.pathname !== ScriptedPath.Completions) {
    return errorAnswer({ status: HttpStatusCode.NotFound, message: 'no such route' });
  }

  if (request.headers.authorization !== SCRIPTED_AUTHORIZATION) {
    return errorAnswer({ status: HttpStatusCode.Unauthorized, message: 'the key is not the one the stack staged' });
  }

  const sessionId = Result.getSuccess(
    Schema.decodeUnknownResult(Schema.String)(request.headers[HttpHeader.XSessionId]),
  );

  if (Option.isNone(sessionId)) {
    return errorAnswer({ status: HttpStatusCode.BadRequest, message: `no ${HttpHeader.XSessionId} header` });
  }

  const answered = scriptedChat({ body: request.body });

  if (Option.isNone(answered)) {
    return errorAnswer({
      status: HttpStatusCode.BadRequest,
      message: 'no end user, or no final user or tool message for a scripted offer',
    });
  }

  const { chat, final } = answered.value;
  const reply = scriptedReply({ messages: chat.messages, final });

  return streamAnswer({ ...chat, reply, body: request.body, sessionId: sessionId.value });
}

/** The request's chat for a scripted offer and its final message, a person's or a tool's, which a reply answers. */
function scriptedChat({ body }: ScriptedChatInput): Option.Option<ScriptedChat> {
  const isScriptedOffer: (request: ChatRequest) => boolean = ({ model }) =>
    Record.values(SCRIPTED_OFFERS).some((offer) => offer.id === model);

  const chat = Option.filter(Result.getSuccess(Schema.decodeUnknownResult(ChatRequest)(body)), isScriptedOffer);

  const final = Option.filter(
    Option.flatMap(chat, ({ messages }) => Array.last(messages)),
    ({ role }) => ANSWERED_ROLES.has(role),
  );

  return Option.all({ chat, final });
}
