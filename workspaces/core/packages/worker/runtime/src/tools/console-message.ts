import { PresentationSpecification } from '@mechane/protocol/presentation';
import { tool } from 'ai';
import { z } from 'zod';
import { withToolStore } from './context.ts';
import type { RuntimeToolContext, ToolInvocation } from './types.ts';

const CONSOLE_MESSAGE_MAX_CHARACTERS = 65_536;

const ConsoleMessage = z.strictObject({
  text: z.string().min(1).max(CONSOLE_MESSAGE_MAX_CHARACTERS),
  presentation: PresentationSpecification.optional(),
});

type PublishConsoleInput = ToolInvocation & z.infer<typeof ConsoleMessage>;

export function consoleMessageTool(context: RuntimeToolContext) {
  return tool({
    description:
      'Send a message to this mech’s Console conversation. This is a public communication action. It does not send to an external service. Use the installed tools for other destinations. Ordinary assistant text is private execution context.',
    inputSchema: ConsoleMessage,
    execute: (input, options) => publishConsoleMessage({ ...context, ...input, toolCallId: options.toolCallId }),
  });
}

async function publishConsoleMessage(input: PublishConsoleInput) {
  const message = consolePublication(input);
  const published = await withToolStore((store) => store.publishConsoleMessage(message));

  return { status: 'sent', messageId: published.id, createdAt: published.createdAt };
}

function consolePublication(input: PublishConsoleInput) {
  const message = { runId: input.runId, toolCallId: input.toolCallId, text: input.text };

  if (input.presentation === undefined) {
    return message;
  }

  return { ...message, presentation: input.presentation };
}
