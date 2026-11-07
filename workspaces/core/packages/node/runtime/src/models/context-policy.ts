import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { pruneMessages } from 'ai';
import type { ModelMessage } from 'ai';
import { FatalError } from 'workflow';
import { loadContextCheckpoint, saveContextCheckpoint } from './context-checkpoint.ts';
import { summarizeHistory, summarizeNativeContext } from './context-summary.ts';
import { contextBytes, summaryCut, summaryMessage } from './context-window.ts';
import type { ContextWindow } from './context-window.ts';
import type { ModelReference } from './model-reference.ts';

type ContextInput = {
  readonly reference: ModelReference;
  readonly instructions: string;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly historyMessageCount: number;
};

type ContextStep = { readonly messages: LanguageModelV4Prompt };
type NativePreparation = (step: ContextStep) => Promise<ContextStep | undefined>;
type AgentContext = { readonly messages: ReturnType<typeof pruneMessages>; readonly prepareStep: NativePreparation };

type NativePolicy = {
  readonly reference: ModelReference;
  readonly instructions: string;
  readonly summary: string | null;
  readonly window: ContextWindow;
};

export async function prepareAgentContext(input: ContextInput): Promise<AgentContext> {
  const { window, checkpoint } = await loadContextCheckpoint(input.reference);
  const state = { summary: checkpoint?.summary ?? null, covered: checkpoint?.coveredMessageCount ?? 0 };

  if (state.covered > input.historyMessageCount) {
    throw new FatalError('The stored context summary does not match the conversation history.');
  }

  const pruned = pruneMessages({
    messages: [...input.messages],
    reasoning: 'all',
    toolCalls: 'none',
    emptyMessages: 'keep',
  });

  const retained = pruned
    .map((message, index) => ({ message, end: index + 1 }))
    .filter((entry) => entry.end > state.covered && entry.message.content.length > 0);

  while (
    contextBytes([input.instructions, state.summary, ...retained.map((entry) => entry.message)]) > window.triggerBytes
  ) {
    const remainingHistory = retained.filter((entry) => entry.end <= input.historyMessageCount).length;

    const cut = summaryCut({
      messages: retained.map((entry) => entry.message),
      maximumCut: remainingHistory,
      maximumBytes: window.summaryInputBytes,
    });

    if (cut === null) {
      throw oversizedContext();
    }

    const prefix = retained.splice(0, cut);
    const last = prefix.at(-1);

    if (last === undefined) {
      throw oversizedContext();
    }

    state.summary = await summarizeHistory({
      reference: input.reference,
      previousSummary: state.summary,
      messages: prefix.map((entry) => entry.message),
      maxOutputTokens: window.summaryOutputTokens,
    });

    state.covered = last.end;

    await saveContextCheckpoint({
      reference: input.reference,
      checkpoint: { summary: state.summary, coveredMessageCount: state.covered },
    });
  }

  const messages = retained.map((entry) => entry.message);

  if (state.summary !== null) {
    messages.unshift(summaryMessage(state.summary));
  }

  return { messages, prepareStep: nativeContextPolicy({ ...input, summary: state.summary, window }) };
}

function nativeContextPolicy({ reference, instructions, summary, window }: NativePolicy): NativePreparation {
  const state = { summary };

  return async ({ messages }) => {
    if (contextBytes(messages) <= window.triggerBytes) {
      return;
    }

    const conversation = messages.filter((message) => message.role !== 'system');

    while (contextBytes([instructions, state.summary, ...conversation]) > window.triggerBytes) {
      const cut = summaryCut({
        messages: conversation,
        maximumCut: conversation.length,
        maximumBytes: window.summaryInputBytes,
      });

      if (cut === null) {
        throw oversizedContext();
      }

      const latestUser = conversation.findLast((message) => message.role === 'user');
      const prefix = conversation.splice(0, cut);

      state.summary = await summarizeNativeContext({
        reference,
        previousSummary: state.summary,
        messages: prefix,
        maxOutputTokens: window.summaryOutputTokens,
      });

      if (latestUser !== undefined && prefix.includes(latestUser)) {
        conversation.unshift(latestUser);
      }
    }

    const system: LanguageModelV4Prompt = [{ role: 'system', content: instructions }];

    if (state.summary !== null) {
      system.push(summaryMessage(state.summary));
    }

    return { messages: [...system, ...conversation] };
  };
}

function oversizedContext(): FatalError {
  return new FatalError(
    'The instructions or a recent exchange exceed this model’s context window. The complete conversation remains available; shorten the input or use a larger model.',
  );
}
