import { Option } from 'effect';
import { ChatRole } from './constants.ts';
import type { ChatMessage, ContentPart } from './schemas.ts';
import type { ScriptedReplyInput } from './types.ts';

/** What separates the tool results of a round in the echo that answers them. */
const RESULT_SEPARATOR = '\n';

type ChatMessageInput = { readonly message: ChatMessage };

/** The text a reply answers: a person's final message, or every tool result of the round a final result ends. */
export function answeredText({ messages, final }: ScriptedReplyInput): string {
  if (final.role !== ChatRole.Tool) {
    return messageText({ message: final });
  }

  return messages
    .slice(messages.findLastIndex(({ role }) => role === ChatRole.Assistant) + 1)
    .filter(({ role }) => role === ChatRole.Tool)
    .map((message) => messageText({ message }))
    .join(RESULT_SEPARATOR);
}

/** A message's text, its text parts joined. */
function messageText({ message }: ChatMessageInput): string {
  const content = Option.getOrElse(message.content, () => []);
  const partText: (part: ContentPart) => string = (part) => Option.getOrElse(part.text, () => '');

  if (typeof content === 'string') {
    return content;
  }

  return content.map(partText).join('');
}
