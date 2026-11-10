import type { ControlStore } from '@mechane/control-store';
import { catalog } from '@mechane/protocol';
import type { OperationInput } from '@mechane/protocol';
import { Option } from 'effect';
import type { MechActorResolver } from '../actor/client.ts';
import type { ConsoleMessage, NotificationProducer, NotificationReceipt } from '../domain.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import { requireAuthenticated, validatedOperation } from './validated-operation.ts';

const CONVERSATION_PAGE_MAX_ROWS = 100;
type NotificationOperationsInput = { readonly store: ControlStore; readonly actors: MechActorResolver };

type AdmissionInput = Pick<NotificationOperationsInput, 'actors'> & {
  readonly input: OperationInput<typeof catalog.sendNotification>;
  readonly producer: NotificationProducer;
  readonly shouldPublishToConsole?: boolean;
};

export async function admitNotification({ actors, input, producer, shouldPublishToConsole = false }: AdmissionInput) {
  const actor = actors(input);

  const receipt = await actor.admitNotification({
    id: input.notificationId,
    text: input.text,
    source: input.source,
    producer,
    data: input.data ?? null,
    shouldPublishToConsole,
  });

  return notificationReceiptWire(receipt);
}

function notificationReceiptWire(receipt: NotificationReceipt) {
  return {
    id: receipt.id,
    mech_id: receipt.mechId,
    received_at: receipt.receivedAt,
    received_sequence: receipt.receivedSequence,
    was_created: receipt.wasCreated,
  };
}

export function createNotificationOperations({ store, actors }: NotificationOperationsInput) {
  return {
    sendNotification: validatedOperation({
      operation: catalog.sendNotification,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);

        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });
        await store.getMech(input);

        return await admitNotification({
          actors,
          input,
          producer: { kind: 'member', principalId: authenticated.principalId },
          shouldPublishToConsole: authenticated.authKind === 'session' && input.source.name === 'console',
        });
      },
    }),
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

export function consoleMessageWire(message: ConsoleMessage) {
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
