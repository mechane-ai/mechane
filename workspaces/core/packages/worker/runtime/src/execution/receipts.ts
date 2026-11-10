import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ControlStore } from '@mechane/control-store';
import { StoreConflict } from '@mechane/control-store';
import { toolExecutionId as executionId } from '@mechane/records';
import { Option } from 'effect';
import { Effects, putEffect, runEffects, Turns } from '../actor/collections.ts';
import type { EffectRecord } from '../actor/record-schemas.ts';
import { decodeStored, RunRecord, StoredFields } from '../actor/records.ts';
import type { ActorAccess } from '../actor/types.ts';
import type { ExecutionReceipt } from '../domain.ts';
import { appendEvent } from '../notifications/admission.ts';
import { publishMessage } from '../self/messages.ts';
import type { RuntimeToolStore } from '../tools/context.ts';

function decodeReceiptFields(serialized: string | null): Readonly<Record<string, unknown>> | null {
  if (serialized === null) {
    return null;
  }

  return decodeStored(StoredFields, serialized);
}

function receipt(record: EffectRecord): ExecutionReceipt {
  return { ...record, request: decodeReceiptFields(record.request), result: decodeReceiptFields(record.result) };
}

export function toolStore(
  access: ActorAccess,
  control: ControlStore,
  canDispatchExecution: RuntimeToolStore['canDispatchExecution'] = async () => false,
): RuntimeToolStore {
  return {
    ...control,
    canDispatchExecution,
    getRun: async (input) => {
      if (input.workspaceId !== undefined && input.workspaceId !== access.scope.workspaceId) {
        return null;
      }

      const found = await Turns.get(access.harness, input.runId, BACKGROUND_CONTEXT);

      if (found === undefined) {
        return null;
      }

      return decodeStored(RunRecord, found.value);
    },
    beginExecution: async (input) =>
      await access.harness.commit(async (transaction) => {
        const request = Option.match(Option.fromNullishOr(input.request), {
          onNone: () => null,
          onSome: (payload) => JSON.stringify(payload),
        });

        const existing = await Effects.read(transaction, input.id);

        if (existing !== undefined) {
          if (existing.runId !== input.runId || existing.kind !== input.kind || existing.request !== request) {
            throw new StoreConflict('The execution identity has a different immutable request');
          }

          return { wasCreated: false, receipt: receipt({ ...existing }) };
        }

        const createdAt = new Date().toISOString();

        const effect = {
          id: input.id,
          runId: input.runId,
          runtimeSource: 'native' as const,
          kind: input.kind,
          request,
          status: 'pending' as const,
          providerId: null,
          result: null,
          createdAt,
          updatedAt: createdAt,
        };

        await putEffect(transaction, effect);

        return { wasCreated: true, receipt: receipt(effect) };
      }, BACKGROUND_CONTEXT),
    finishExecution: async (input) =>
      await access.harness.commit(async (transaction) => {
        const existing = await Effects.read(transaction, input.id);

        if (existing === undefined) {
          throw new Error('The execution has no durable intent');
        }

        if (existing.status === 'completed' && JSON.stringify(input.result) !== existing.result) {
          throw new StoreConflict('The execution result changed after completion');
        }

        const updated = {
          ...existing,
          status: input.status,
          providerId: input.providerId,
          result: JSON.stringify(input.result),
          updatedAt: new Date().toISOString(),
        };

        await putEffect(transaction, updated);

        return receipt(updated);
      }, BACKGROUND_CONTEXT),
    getExecution: async (input) => {
      if (input.workspaceId !== access.scope.workspaceId || input.mechId !== access.scope.mechId) {
        return null;
      }

      const existing = await Effects.get(access.harness, input.id, BACKGROUND_CONTEXT);

      if (existing === undefined) {
        return null;
      }

      return receipt(existing);
    },
    listRunExecutions: async (input) => {
      if (input.workspaceId !== access.scope.workspaceId) {
        return [];
      }

      return await access.harness.commit(async (transaction) => {
        const ids = await runEffects(input.runId).allInTransaction(transaction);
        const results: Array<ExecutionReceipt & { readonly mechId: string }> = [];

        for (const id of ids) {
          const effect = await Effects.read(transaction, id);

          if (effect === undefined || effect.runId !== input.runId) {
            throw new Error('The execution index has no matching receipt');
          }

          results.push({ ...receipt(effect), mechId: access.scope.mechId });
        }

        return results;
      }, BACKGROUND_CONTEXT);
    },
    appendActivity: async (input) =>
      await access.harness.commit(async (transaction) => {
        if (input.workspaceId !== access.scope.workspaceId || input.mechId !== access.scope.mechId) {
          throw new Error('The activity scope does not match its actor');
        }

        await appendEvent(transaction, { id: input.id, type: input.type, runId: input.runId, payload: input.payload });
      }, BACKGROUND_CONTEXT),
    publishConsoleMessage: async (input) => {
      const messageId = await executionId({ runId: input.runId, toolCallId: `message:${input.toolCallId}` });

      return await publishMessage(
        access,
        { messageId, text: input.text, presentation: input.presentation },
        { isCurrent: canDispatchExecution },
      );
    },
  };
}
