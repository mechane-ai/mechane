import { hook, ToolTask } from '@earendil-works/pi-durable';
import type { Harness } from '@earendil-works/pi-durable';
import { appendManagedEvent } from '../event-log/write.ts';
import { sessionState } from '../scheduler.ts';

export function unavailableToolEvents(harness: Harness, sessionId: string) {
  return hook(ToolTask, {
    afterTool: async (...arguments_) => {
      const [call, result, api, context] = arguments_;
      const unavailable = result.diagnostics?.find((diagnostic) => diagnostic.code === 'tool_unavailable');

      if (unavailable === undefined || call.parent !== undefined) {
        return result;
      }

      await harness.commit(async (transaction) => {
        const state = await sessionState(transaction, sessionId);

        const isEnded = state.isArchived || state.interrupt !== null || state.activeEvent === null;

        if (isEnded || state.conversation !== api.conversationId) {
          return;
        }

        const use = await appendManagedEvent(
          transaction,
          { sessionId, stableKey: `unavailable-use:${api.taskId}` },
          { type: 'agent.tool_use', name: call.name, input: call.arguments, evaluated_permission: 'deny' },
        );

        await appendManagedEvent(
          transaction,
          { sessionId, stableKey: `unavailable-result:${api.taskId}` },
          {
            type: 'agent.tool_result',
            tool_use_id: use.id,
            is_error: true,
            content: [{ type: 'text', text: unavailable.message }],
          },
        );
      }, context);

      return result;
    },
  });
}
