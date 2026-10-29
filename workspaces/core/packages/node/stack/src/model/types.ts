import type { Duration } from 'effect';
import type { AnsweredRequest, ServedAnswer } from '../types.ts';
import type { ChatMessage } from './schemas.ts';

/**
 * A scripted reply: its delta, the finish reason it ends with, the completion its usage counts, and how long its stream
 * stays open between its first chunk and its last.
 */
export type ScriptedReply = {
  readonly delta: Readonly<Record<string, unknown>>;
  readonly finishReason: string;
  readonly completion: string;
  readonly hold: Duration.Duration;
};

/** A request's messages, and its final one, a person's or a tool's, which a scripted reply answers. */
export type ScriptedReplyInput = { readonly messages: ReadonlyArray<ChatMessage>; readonly final: ChatMessage };

/** The id of a scripted reply, which every chunk of its stream carries. */
export type ReplyId = `scripted-${string}`;

/** A call of a scripted reply, as the wire's `function` object names its tool and carries its JSON arguments. */
export type ScriptedCall = { readonly name: string; readonly arguments: string };

/** How the scripted upstream answered: its answer, and the request it answered with a reply, if any. */
export type ModelAnswer = ServedAnswer & { readonly answered: ReadonlyArray<AnsweredRequest> };
