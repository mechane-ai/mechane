import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineDoc, defineDocFamily, LiveDoc } from '@earendil-works/pi-durable';
import type { ConversationId, Harness, Tx } from '@earendil-works/pi-durable';
import { RawUsage } from '@mechane/model-gateway';
import type { BeginManagedModelSpan, ModelSpanResult } from '@mechane/model-gateway';
import { Schema } from 'effect';
import type { WithControl } from '../actor/types.ts';
import { appendManagedEvent, readManagedEvent } from './event-log/write.ts';
import { appendManagedAssistant } from './preview-output.ts';
import type { GenerationRegistry, PublicGeneration } from './preview-output.ts';
import { sessionState, Slot } from './scheduler.ts';

type SpanReceipt = {
  readonly localId: string;
  readonly attemptId: string;
  readonly startId: string;
  readonly mechId: string;
  readonly activationId: string;
  readonly publicTaskId: number | null;
};

const OpenSpan = defineDoc<{ readonly receipt: SpanReceipt | null }>({
  kind: 'managed.active-model-span',
  scope: 'session',
  version: 1,
  initial: () => ({ receipt: null }),
  checkpointWhen: () => true,
});

export const LastModelFailure = defineDocFamily<{ readonly detail: string | null }, null>({
  kind: 'managed.last-model-failure',
  scope: 'session',
  version: 1,
  family: true,
  initial: () => ({ detail: null }),
  checkpointWhen: () => true,
});

type PreviewCoordinate = PublicGeneration & {
  readonly conversationId: ConversationId;
  readonly attempt: number;
  readonly timestamp: number;
};

export async function openModelSpan(harness: Harness): Promise<string | undefined> {
  const active = await harness.snapshot(OpenSpan, BACKGROUND_CONTEXT);

  return active?.receipt?.startId;
}

export async function activePreviewSpan(harness: Harness, coordinate: PreviewCoordinate): Promise<string | undefined> {
  return await harness.commit(async (transaction): Promise<string | undefined> => {
    const { receipt } = await transaction.doc(OpenSpan);

    if (receipt?.localId !== coordinate.sessionId || receipt.publicTaskId !== coordinate.taskId) {
      return;
    }

    const live = await transaction.doc(LiveDoc, coordinate.conversationId);

    if (live.run?.taskId !== coordinate.taskId || live.generation?.attempt !== coordinate.attempt) {
      return;
    }

    if (live.generation.message?.timestamp !== coordinate.timestamp) {
      return;
    }

    return receipt.startId;
  }, BACKGROUND_CONTEXT);
}

function publicTask(sessionId: string, generation?: PublicGeneration): number | null {
  if (generation?.sessionId === sessionId) {
    return generation.taskId;
  }

  return null;
}

type Owner = {
  readonly generations: GenerationRegistry;
  readonly harness: () => Harness;
  readonly workspaceId: string;
  readonly withControl: WithControl;
};

function measuredTokens(usage: RawUsage | null) {
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const written = usage?.prompt_tokens_details?.cache_write_tokens ?? 0;

  const counts = {
    cache_creation_input_tokens: written,
    cache_read_input_tokens: cached,
    input_tokens: Math.max(0, (usage?.prompt_tokens ?? 0) - cached - written),
    output_tokens: usage?.completion_tokens ?? 0,
  };

  if (usage?.speed === undefined) {
    return counts;
  }

  return { ...counts, speed: usage.speed };
}

type Completion = {
  readonly receipt: SpanReceipt;
  readonly result: ModelSpanResult;
  readonly generation?: PublicGeneration | undefined;
};

function recordedUsage(value: unknown): RawUsage | null {
  if (Schema.is(RawUsage)(value)) {
    return value;
  }

  return null;
}

async function completeSpan(transaction: Tx, { receipt, result, generation }: Completion) {
  const pending = await transaction.doc(OpenSpan);

  if (pending.receipt?.startId !== receipt.startId) {
    return;
  }

  pending.receipt = null;
  const sessionId = receipt.localId;

  if ((await readManagedEvent(transaction, sessionId, receipt.startId)) === undefined) {
    return;
  }

  const state = await sessionState(transaction, sessionId);
  const interrupted = state.interrupt !== null || state.activation !== receipt.activationId;
  const isError = result.isError || interrupted;
  const lastFailure = await transaction.doc(LastModelFailure, sessionId, null);

  if (isError && !interrupted) {
    lastFailure.detail = result.errorDetail ?? null;
  } else {
    lastFailure.detail = null;
  }

  if (!isError && result.message !== undefined && generation?.sessionId === sessionId) {
    await appendManagedAssistant(transaction, generation, result.message);
  }

  await appendManagedEvent(
    transaction,
    { sessionId, stableKey: `model-end:${receipt.attemptId}` },
    {
      type: 'span.model_request_end',
      model_request_start_id: receipt.startId,
      is_error: isError,
      model_usage: measuredTokens(result.usage),
    },
  );
}

export function managedModelSpans({ harness, withControl, workspaceId, generations }: Owner) {
  const begin: BeginManagedModelSpan = async (execution, attemptId, signal) => {
    const generation = generations.take(signal);

    const receipt = await harness().commit(async (transaction) => {
      const slot = await transaction.doc(Slot);

      if (slot.owner === null) {
        throw new Error('The model request has no session.');
      }

      const state = await sessionState(transaction, slot.owner, execution.threadId);

      if (state.publicSessionId !== execution.sessionId || state.activation !== execution.activationId) {
        throw new Error('The model request belongs to another turn.');
      }

      const pending = await transaction.doc(OpenSpan);

      if (pending.receipt !== null) {
        throw new Error('The previous model request has not closed.');
      }

      const start = await appendManagedEvent(
        transaction,
        { sessionId: state.id, stableKey: `model-start:${attemptId}` },
        { type: 'span.model_request_start' },
      );

      const opened: SpanReceipt = {
        localId: state.id,
        attemptId,
        startId: start.id,
        mechId: state.runtimeMechId,
        activationId: execution.activationId,
        publicTaskId: publicTask(state.id, generation),
      };

      pending.receipt = opened;

      return opened;
    }, BACKGROUND_CONTEXT);

    return {
      finish: async (result) => {
        await harness().commit(
          (transaction) => completeSpan(transaction, { receipt, result, generation }),
          BACKGROUND_CONTEXT,
        );
      },
    };
  };

  async function recover() {
    const pending = await harness().snapshot(OpenSpan, BACKGROUND_CONTEXT);
    const receipt = pending?.receipt;

    if (receipt === null || receipt === undefined) {
      return;
    }

    const attempt = await withControl((store) =>
      store.getProviderAttempt({ workspaceId, mechId: receipt.mechId, id: receipt.attemptId }),
    );

    const usage = recordedUsage(attempt?.upstreamUsage);
    const result = { isError: true, usage };

    await harness().commit((transaction) => completeSpan(transaction, { receipt, result }), BACKGROUND_CONTEXT);
  }

  return { begin, recover };
}
