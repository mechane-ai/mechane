import { PresentationOutput } from '@mechane/protocol/presentation';
import type { ModelMessage } from 'ai';

type RunOutput = { readonly reply: string; readonly presentation: PresentationOutput | null };

export function runOutput(messages: ReadonlyArray<ModelMessage>): RunOutput {
  const state: RunOutput = { reply: '', presentation: null };
  let output = state;

  for (const message of messages) {
    output = outputFromMessage(output, message);
  }

  if (output.reply.length === 0 && output.presentation !== null) {
    return { reply: output.presentation.fallback, presentation: output.presentation };
  }

  return output;
}

function presentationFromMessage(message: ModelMessage): PresentationOutput | null {
  if (message.role !== 'tool') {
    return null;
  }

  const presentations: Array<PresentationOutput> = [];

  for (const part of message.content) {
    if (part.type === 'tool-result' && part.toolName === 'render_ui' && part.output.type === 'json') {
      const presentation = PresentationOutput.safeParse(part.output.value);

      if (presentation.success) {
        presentations.push(presentation.data);
      }
    }
  }

  return presentations.at(-1) ?? null;
}

function outputFromMessage(output: RunOutput, message: ModelMessage): RunOutput {
  if (message.role === 'assistant') {
    if (typeof message.content === 'string') {
      return { ...output, reply: message.content };
    }

    const reply = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');

    return { ...output, reply };
  }

  return { ...output, presentation: presentationFromMessage(message) ?? output.presentation };
}
