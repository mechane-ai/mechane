import type { ControlStore } from '@mechane/control-store';
import { catalog } from '@mechane/protocol';
import { Option } from 'effect';
import type { MechActorResolver } from '../actor/client.ts';
import type { ConsoleMessage } from '../domain.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import { validatedOperation } from './validated-operation.ts';

const CONVERSATION_PAGE_MAX_ROWS = 100;
type ConversationOperationsInput = { readonly store: ControlStore; readonly actors: MechActorResolver };

export function createConversationOperations({ store, actors }: ConversationOperationsInput) {
  return {
    listConsoleMessages: validatedOperation({
      operation: catalog.listConsoleMessages,
      run: async ({ input, caller }) => {
        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });
        await store.getMech(input);

        const selection: { maxRows: number; beforeSequence?: number; afterSequence?: number } = {
          maxRows: CONVERSATION_PAGE_MAX_ROWS,
        };

        if (Option.isSome(input.beforeSequence)) {
          selection.beforeSequence = input.beforeSequence.value;
        }

        if (Option.isSome(input.afterSequence)) {
          selection.afterSequence = input.afterSequence.value;
        }

        const page = await actors(input).listConsoleMessages(selection);

        return {
          messages: page.messages.map(consoleMessageWire),
          has_more: page.hasMore,
          before_sequence: page.beforeSequence,
        };
      },
    }),
  };
}

function consoleMessageWire(message: ConsoleMessage) {
  return {
    id: message.id,
    mech_id: message.mechId,
    run_id: message.runId,
    role: message.role,
    text: message.text,
    presentation: message.presentation,
    created_at: message.createdAt,
    sequence: message.sequence,
  };
}
