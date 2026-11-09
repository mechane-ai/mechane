import type { LanguageModelV4Message, LanguageModelV4Prompt } from '@ai-sdk/provider';
import { pruneMessages } from 'ai';
import type { ModelMessage } from 'ai';
import { FatalError } from 'workflow';
import { loadContextWindow } from './context-limits.ts';
import { summarizeHistory, summarizeNativeContext } from './context-summary.ts';
import { contextBytes, summaryCut, summaryMessage } from './context-window.ts';
import type { ContextWindow } from './context-window.ts';
import type { ModelReference } from './model-reference.ts';

const MAXIMUM_CONTEXT_SUMMARIES = 8;

type ContextInput = {
  readonly reference: ModelReference;
  readonly instructions: string;
  readonly messages: ReadonlyArray<ModelMessage>;
};

type ContextStep = { readonly messages: LanguageModelV4Prompt };

type AgentContext = {
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly exceedsWindow: (messages: ReadonlyArray<ModelMessage>) => boolean;
  readonly compact: (messages: ReadonlyArray<ModelMessage>) => Promise<ReadonlyArray<ModelMessage>>;
  readonly prepareStep: (step: ContextStep) => Promise<ContextStep>;
};

type CompactInput<Message extends ModelMessage | LanguageModelV4Message> = {
  readonly messages: ReadonlyArray<Message>;
  readonly instructions: string;
  readonly window: ContextWindow;
  readonly summarize: (messages: ReadonlyArray<Message>) => Promise<string>;
  readonly makeSummary: (summary: string) => Message;
};

export async function prepareAgentContext({ reference, instructions, messages }: ContextInput): Promise<AgentContext> {
  const window = await loadContextWindow(reference);

  function exceedsWindow(conversation: ReadonlyArray<ModelMessage>): boolean {
    return contextBytes([instructions, ...conversation]) > window.triggerBytes;
  }

  async function compact(conversation: ReadonlyArray<ModelMessage>): Promise<ReadonlyArray<ModelMessage>> {
    const retained = pruneMessages({
      messages: [...conversation],
      reasoning: 'all',
      toolCalls: 'none',
      emptyMessages: 'keep',
    });

    return await compactMessages<ModelMessage>({
      messages: retained,
      instructions,
      window,
      makeSummary: summaryMessage,
      summarize: async (prefix) =>
        await summarizeHistory({
          reference,
          previousSummary: null,
          messages: prefix,
          maxOutputTokens: window.summaryOutputTokens,
        }),
    });
  }

  async function prepareStep(step: ContextStep): Promise<ContextStep> {
    if (contextBytes(step.messages) <= window.triggerBytes) {
      return step;
    }

    const conversation = step.messages.filter(
      (message) => message.role !== 'system' || message.content !== instructions,
    );

    const retained = await compactMessages<LanguageModelV4Message>({
      messages: conversation,
      instructions,
      window,
      makeSummary: summaryMessage,
      summarize: async (prefix) =>
        await summarizeNativeContext({
          reference,
          previousSummary: null,
          messages: [...prefix],
          maxOutputTokens: window.summaryOutputTokens,
        }),
    });

    return { messages: [{ role: 'system', content: instructions }, ...retained] };
  }

  return { messages: await compact(messages), exceedsWindow, compact, prepareStep };
}

async function compactMessages<Message extends ModelMessage | LanguageModelV4Message>({
  messages,
  instructions,
  window,
  summarize,
  makeSummary,
}: CompactInput<Message>): Promise<ReadonlyArray<Message>> {
  const retained = [...messages];
  const latestUser = retained.findLast((message) => message.role === 'user');

  if (contextBytes([instructions, latestUser]) > window.triggerBytes) {
    throw oversizedContext();
  }

  let summaries = 0;

  while (contextBytes([instructions, ...retained]) > window.triggerBytes) {
    if (summaries >= MAXIMUM_CONTEXT_SUMMARIES) {
      throw oversizedContext();
    }

    const previousBytes = contextBytes(retained);
    const cut = summaryCut({ messages: retained, maximumCut: retained.length, maximumBytes: window.summaryInputBytes });

    if (cut === null) {
      throw oversizedContext();
    }

    const prefix = retained.splice(0, cut);
    const summary = await summarize(prefix);

    if (latestUser !== undefined && prefix.includes(latestUser)) {
      retained.unshift(latestUser);
    }

    retained.unshift(makeSummary(summary));

    summaries += 1;

    if (contextBytes(retained) >= previousBytes) {
      throw oversizedContext();
    }
  }

  return retained;
}

function oversizedContext(): FatalError {
  return new FatalError(
    'The instructions or a recent exchange exceed the working context limit. The complete private trace remains available; shorten the input or use a larger model.',
  );
}
