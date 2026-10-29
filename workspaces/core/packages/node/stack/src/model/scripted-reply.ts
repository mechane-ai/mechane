import { Array, Duration, Option } from 'effect';
import { HOLD_PREFIX, REPLY_PREFIX } from '../constants.ts';
import { answeredText } from './answered-text.ts';
import { ChatRole } from './constants.ts';
import { scriptedCall } from './scripted-call.ts';
import type { ScriptedCall, ScriptedReply, ScriptedReplyInput } from './types.ts';

/** The id of one tool call of a scripted reply, which the tool's result names. */
type ToolCallId = `call-${string}`;

/** What separates the lines of a person's script, one call each. */
const SCRIPT_LINE_BREAK = '\n';

/** Why a scripted reply ends: with its text, or with its tool call, for the tool's result to come back. */
const FinishReason = { Stop: 'stop', ToolCalls: 'tool_calls' } as const;

/** One tool call of a reply's delta, as the chat-completions stream writes it. */
type ToolCallDelta = {
  readonly index: number;
  readonly id: ToolCallId;
  readonly type: 'function';
  readonly function: ScriptedCall;
};

/** The lines to search, and the prefix of the line to find. */
type PrefixedLineInput = {
  /** The lines of a person's final message, none for a final tool result. */
  readonly lines: Option.Option<ReadonlyArray<string>>;
  readonly prefix: string;
};

/**
 * The reply to the messages after the model's last one. A person's message of `$ <command>` and `@<tool> <JSON object>`
 * lines gets those calls in line order, so pi runs one sequential round. A `> <text>` line answers with its text, a `~
 * <ms>` line holds the stream open, and any other message gets an echo of its text.
 */
export function scriptedReply({ messages, final }: ScriptedReplyInput): ScriptedReply {
  const text = answeredText({ messages, final });
  const lines = Option.liftPredicate(text.split(SCRIPT_LINE_BREAK), () => final.role === ChatRole.User);

  const lineCalls: (all: ReadonlyArray<string>) => Option.Option<ReadonlyArray<ScriptedCall>> = (all) =>
    Option.all(all.map((line) => scriptedCall({ line })));

  const calls = Option.flatMap(lines, lineCalls);

  const toolCallDelta: (call: ScriptedCall, index: number) => ToolCallDelta = (call, index) => ({
    index,
    id: `call-${crypto.randomUUID()}`,
    type: 'function',
    function: call,
  });

  if (Option.isSome(calls)) {
    return {
      delta: { tool_calls: calls.value.map(toolCallDelta) },
      finishReason: FinishReason.ToolCalls,
      completion: calls.value.map((call) => call.arguments).join(''),
      hold: Duration.zero,
    };
  }

  const answer = Option.getOrElse(prefixedLine({ lines, prefix: REPLY_PREFIX }), () => text);
  const held = Option.filter(Option.map(prefixedLine({ lines, prefix: HOLD_PREFIX }), Number), Number.isSafeInteger);

  return {
    delta: { content: answer },
    finishReason: FinishReason.Stop,
    completion: answer,
    hold: Duration.millis(Option.getOrElse(held, () => 0)),
  };
}

/** The rest of the first line that starts with the prefix, none when no line does or there are no lines. */
function prefixedLine({ lines, prefix }: PrefixedLineInput): Option.Option<string> {
  const firstPrefixed: (all: ReadonlyArray<string>) => Option.Option<string> = (all) =>
    Array.findFirst(all, (line) => line.startsWith(prefix));

  return Option.map(Option.flatMap(lines, firstPrefixed), (line) => line.slice(prefix.length));
}
