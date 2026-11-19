import type { Context } from '@earendil-works/chord/context';
import type { Harness, ToolExecutionResult } from '@earendil-works/pi-durable';
import { sessionEvents } from './event-log/payload-storage.ts';
import { appendManagedEvent } from './event-log/write.ts';
import type { ExclusiveEffect } from './execution-gate.ts';
import { nativeResultContent } from './large-native-content.ts';
import { transition } from './lifecycle.ts';
import { waitForOwner } from './ownership.ts';
import type { ManagedToolCall } from './pi-tools.ts';
import { CallReceipts, release, sessionState, Slot } from './scheduler.ts';
import type { ManagedToolEvaluator } from './tools/auto-policy.ts';

function deniedMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  return 'Permission denied';
}

type ExternalToolRequest = {
  readonly harness: Harness;
  readonly call: ManagedToolCall;
  readonly context: Context;
  readonly wake: () => void;
  readonly exclusive: ExclusiveEffect;
  readonly evaluate: ManagedToolEvaluator;
};

export async function waitManagedTool({
  harness,
  call,
  context,
  wake,
  exclusive,
  evaluate,
}: ExternalToolRequest): Promise<ToolExecutionResult> {
  if (call.kind === 'mcp') {
    throw new Error('MCP tools must use the configured server.');
  }

  const useId = await exclusive(context.abortSignal, async () => {
    const evaluation = await evaluate(call, context);

    return await harness.commit(async (transaction) => {
      const state = await sessionState(transaction, call.sessionId);

      if (state.activeEvent === null || state.isArchived || state.interrupt !== null) {
        throw new Error('The tool execution has ended');
      }

      const pointer = await transaction.doc(CallReceipts, JSON.stringify([state.id, 'native', call.nativeId]), null);

      if (pointer.eventId !== '') {
        return pointer.eventId;
      }

      const slot = await transaction.doc(Slot);

      if (slot.owner !== state.id) {
        throw new Error('The session has no execution slot');
      }

      const fields = { type: 'agent.tool_use', name: call.name, input: call.input, ...evaluation };

      if (call.kind === 'custom') {
        fields.type = 'agent.custom_tool_use';
      }

      const event = await appendManagedEvent(
        transaction,
        { sessionId: state.id, stableKey: `tool:${call.nativeId}` },
        fields,
      );

      const receipt = await transaction.doc(CallReceipts, JSON.stringify([state.id, event.id]), null);
      pointer.eventId = event.id;
      receipt.eventId = event.id;
      receipt.nativeId = call.nativeId;
      receipt.nativeKind = call.kind;

      if (evaluation?.evaluated_permission === 'deny') {
        const result = await appendManagedEvent(
          transaction,
          { sessionId: state.id, stableKey: `denied:${call.nativeId}` },
          {
            type: 'agent.tool_result',
            tool_use_id: event.id,
            is_error: true,
            content: [{ type: 'text', text: `Permission to use ${call.name} has been denied.` }],
          },
        );

        receipt.stage = 'complete';
        receipt.resultId = result.id;

        return event.id;
      }

      receipt.stage = 'result';

      if (evaluation?.evaluated_permission === 'ask') {
        receipt.stage = 'approval';
      }

      state.waiting = event.id;

      if (receipt.stage === 'approval' || call.kind === 'custom') {
        await transition(transaction, {
          sessionId: state.id,
          status: 'idle',
          reason: { type: 'requires_action', event_ids: [event.id] },
        });
      }

      await release(transaction, state.id);

      return event.id;
    }, context);
  });

  wake();
  await waitForOwner(harness, call.sessionId, context);

  return await harness.commit(async (transaction) => {
    const state = await sessionState(transaction, call.sessionId);
    const slot = await transaction.doc(Slot);
    const receipt = await transaction.doc(CallReceipts, JSON.stringify([state.id, useId]), null);

    const isEnded = state.interrupt !== null || state.isArchived;

    if (slot.owner !== state.id || receipt.stage !== 'complete' || isEnded) {
      throw new Error('The session has no authorized tool result');
    }

    const record = await sessionEvents(state.id).describe(transaction, receipt.resultId);

    if (record === undefined) {
      throw new Error('Missing tool result');
    }

    if (state.waiting === useId) {
      state.waiting = null;
    }

    const result = record.event;

    if (result.type === 'user.tool_confirmation') {
      const message = result['deny_message'];

      return { isError: true, output: [{ type: 'text', text: deniedMessage(message) }] };
    }

    return nativeResultContent(result, record.large);
  }, context);
}
