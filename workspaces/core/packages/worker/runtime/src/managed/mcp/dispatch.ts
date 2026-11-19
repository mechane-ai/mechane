import type { Context } from '@earendil-works/chord/context';
import type { Harness, ToolExecutionResult, Tx } from '@earendil-works/pi-durable';
import { sessionEvents } from '../event-log/payload-storage.ts';
import { appendManagedEvent } from '../event-log/write.ts';
import type { ExclusiveEffect } from '../execution-gate.ts';
import { nativeResultContent } from '../large-native-content.ts';
import { transition } from '../lifecycle.ts';
import { waitForOwner } from '../ownership.ts';
import type { ManagedToolCall } from '../pi-tools.ts';
import { CallReceipts, release, sessionState, Slot } from '../scheduler.ts';
import type { ManagedToolEvaluator } from '../tools/auto-policy.ts';
import { callManagedMcpTool } from './client.ts';
import { currentMcpSetting } from './registry.ts';
import { managedMcpFailure } from './result.ts';
import type { ManagedMcpContext, ManagedMcpResult } from './types.ts';

type McpDispatch = {
  readonly harness: Harness;
  readonly call: ManagedToolCall;
  readonly context: Context;
  readonly wake: () => void;
  readonly runtime: ManagedMcpContext;
  readonly exclusive: ExclusiveEffect;
  readonly evaluate: ManagedToolEvaluator;
  readonly currentEpoch: () => Promise<number>;
};

type Evaluation = NonNullable<Awaited<ReturnType<ManagedToolEvaluator>>>;

function receiptKey(sessionId: string, id: string): string {
  return JSON.stringify([sessionId, id]);
}

function nativeKey(call: ManagedToolCall): string {
  return JSON.stringify([call.sessionId, 'native', call.nativeId]);
}

async function stageCall(
  transaction: Tx,
  call: ManagedToolCall,
  { serverName, evaluation }: { readonly serverName: string; readonly evaluation: Evaluation },
): Promise<string> {
  const state = await sessionState(transaction, call.sessionId);
  const pointer = await transaction.doc(CallReceipts, nativeKey(call), null);

  if (pointer.eventId !== '') {
    return pointer.eventId;
  }

  const slot = await transaction.doc(Slot);

  const hasActiveEvent = state.activeEvent !== null && !state.isArchived;

  if (!hasActiveEvent || state.interrupt !== null || slot.owner !== state.id) {
    throw new Error('The MCP execution has ended');
  }

  const use = await appendManagedEvent(
    transaction,
    { sessionId: state.id, stableKey: `mcp-use:${call.nativeId}` },
    { type: 'agent.mcp_tool_use', mcp_server_name: serverName, name: call.name, input: call.input, ...evaluation },
  );

  const receipt = await transaction.doc(CallReceipts, receiptKey(state.id, use.id), null);
  const isApprovalRequired = evaluation.evaluated_permission === 'ask';

  Object.assign(receipt, {
    eventId: use.id,
    nativeId: call.nativeId,
    nativeKind: 'mcp',
    stage: 'result',
    resultId: '',
  });

  pointer.eventId = use.id;

  if (evaluation.evaluated_permission === 'deny') {
    const result = await appendManagedEvent(
      transaction,
      { sessionId: state.id, stableKey: `mcp-result:${call.nativeId}` },
      {
        type: 'agent.mcp_tool_result',
        mcp_tool_use_id: use.id,
        ...managedMcpFailure('The permission policy denied this MCP tool call.'),
      },
    );

    receipt.stage = 'complete';
    receipt.resultId = result.id;

    return use.id;
  }

  state.waiting = use.id;

  if (isApprovalRequired) {
    receipt.stage = 'approval';

    await transition(transaction, {
      sessionId: state.id,
      status: 'idle',
      reason: { type: 'requires_action', event_ids: [use.id] },
    });
    await release(transaction, state.id);
  }

  return use.id;
}

export async function executeManagedMcpCall({
  harness,
  call,
  context,
  wake,
  runtime,
  exclusive,
  evaluate,
  currentEpoch,
}: McpDispatch): Promise<ToolExecutionResult> {
  const serverName = call.mcpServerName;

  if (serverName === undefined || serverName === '') {
    throw new Error('MCP call is missing its server');
  }

  function key(id: string): string {
    return receiptKey(call.sessionId, id);
  }

  const useId = await exclusive(context.abortSignal, async () => {
    const existing = await harness.commit(async (transaction) => {
      const entry = await transaction.doc(CallReceipts, nativeKey(call), null);

      return entry.eventId;
    }, context);

    if (existing !== '') {
      return existing;
    }

    const evaluation = await evaluate(call, context);

    if (evaluation === null) {
      throw new Error('MCP calls require a permission policy');
    }

    return await harness.commit((transaction) => stageCall(transaction, call, { serverName, evaluation }), context);
  });

  wake();
  await waitForOwner(harness, call.sessionId, context);

  return await exclusive(context.abortSignal, async () => {
    const prior = await harness.commit(async (transaction) => {
      const state = await sessionState(transaction, call.sessionId);
      const slot = await transaction.doc(Slot);

      if (state.isArchived || state.interrupt !== null || slot.owner !== state.id) {
        throw new Error('The MCP call lost its execution slot');
      }

      const receipt = await transaction.doc(CallReceipts, key(useId), null);

      if (receipt.stage === 'complete') {
        const reply = await sessionEvents(state.id).describe(transaction, receipt.resultId);

        if (reply === undefined) {
          throw new Error('Missing recorded MCP result');
        }

        return { reply, started: false };
      }

      if (receipt.stage !== 'result' || state.waiting !== useId) {
        throw new Error('The MCP call requires approval');
      }

      return { reply: null, started: receipt.hasStartedDispatch === true };
    }, context);

    if (prior.reply?.event.type === 'agent.mcp_tool_result') {
      return nativeResultContent(prior.reply.event, prior.reply.large);
    }

    async function beforeDispatch() {
      await currentEpoch();
      await harness.commit(async (transaction) => {
        const state = await sessionState(transaction, call.sessionId);
        const receipt = await transaction.doc(CallReceipts, key(useId), null);
        const slot = await transaction.doc(Slot);
        const setting = currentMcpSetting(state.tools, call.mcpServerName ?? '', call.name);

        const isEnabled = setting?.enabled === true && setting.permission_policy.type === call.policy;
        const isActive = state.mutationId === null && !state.isArchived && state.interrupt === null;
        const isOwner = state.waiting === useId && slot.owner === state.id;
        const isUndispatched = receipt.stage === 'result' && receipt.hasStartedDispatch !== true;
        const hasAuthority = isEnabled && isActive;

        if (!hasAuthority || !isOwner || !isUndispatched) {
          throw new Error('The MCP call is no longer authorized');
        }

        receipt.hasStartedDispatch = true;
      }, context);
    }

    async function resolveResult(): Promise<ManagedMcpResult> {
      if (prior.reply !== null) {
        return managedMcpFailure('Permission denied for the MCP tool call.');
      }

      if (prior.started) {
        return managedMcpFailure(
          'A previous MCP dispatch has no confirmed result. Check the external state before retrying.',
        );
      }

      return await callManagedMcpTool({
        context: { ...runtime, signal: context.abortSignal },
        serverName: call.mcpServerName ?? '',
        name: call.name,
        input: call.input,
        beforeDispatch,
      });
    }

    const result = await resolveResult();

    return await harness.commit(async (transaction) => {
      const state = await sessionState(transaction, call.sessionId);
      const receipt = await transaction.doc(CallReceipts, key(useId), null);

      if (receipt.stage === 'complete' && receipt.resultId !== '') {
        const existing = await sessionEvents(state.id).describe(transaction, receipt.resultId);

        if (existing?.event.type === 'agent.mcp_tool_result') {
          return nativeResultContent(existing.event, existing.large);
        }
      }

      const event = await appendManagedEvent(
        transaction,
        { sessionId: state.id, stableKey: `mcp-result:${call.nativeId}` },
        { type: 'agent.mcp_tool_result', mcp_tool_use_id: useId, ...result },
      );

      receipt.resultId = event.id;
      receipt.stage = 'complete';

      if (state.waiting === useId) {
        state.waiting = null;
      }

      return nativeResultContent(event);
    }, context);
  });
}
