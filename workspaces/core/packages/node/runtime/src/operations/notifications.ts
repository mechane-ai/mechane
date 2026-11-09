import { catalog, NotificationConflict, RequestInvalid } from '@mechane/protocol';
import type { OperationInput } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { Option } from 'effect';
import type { NotificationProducer, NotificationReceipt } from '../domain.ts';
import type { RuntimeStore } from '../store/database.ts';
import { AdmissionRefused, StoreConflict } from '../store/errors.ts';
import { requireWorkspaceMember } from './auth/admission.ts';
import type { StartAdmission } from './types.ts';
import { requireAuthenticated, validatedOperation } from './validated-operation.ts';

const CONVERSATION_PAGE_MAX_ROWS = 100;

type NotificationOperationsInput = { readonly store: RuntimeStore; readonly startAdmission: StartAdmission };

type AdmissionInput = NotificationOperationsInput & {
  readonly input: OperationInput<typeof catalog.sendNotification>;
  readonly producer: NotificationProducer;
  readonly shouldPublishToConsole?: boolean;
};

export async function wakeMech({
  store,
  startAdmission,
  workspaceId,
  mechId,
}: NotificationOperationsInput & { readonly workspaceId: string; readonly mechId: string }): Promise<void> {
  try {
    const run = await store.reservePendingActivation({ workspaceId, mechId });

    if (run !== null) {
      await startAdmission({ runId: run.id });
    }
  } catch {
    console.error({ event: 'notification.wake_deferred', workspaceId, mechId });
  }
}

export async function admitNotification({
  store,
  startAdmission,
  input,
  producer,
  shouldPublishToConsole = false,
}: AdmissionInput) {
  let notification: Parameters<RuntimeStore['admitNotification']>[0] = {
    id: input.notificationId,
    workspaceId: input.workspaceId,
    mechId: input.mechId,
    text: input.text,
    source: input.source,
    producer,
    shouldPublishToConsole,
  };

  if (input.data !== undefined) {
    notification = { ...notification, data: input.data };
  }

  const receipt = await store.admitNotification(notification).catch((failure: unknown) => {
    if (failure instanceof StoreConflict) {
      throw new NotificationConflict({ notificationId: RecordId.make(input.notificationId) });
    }

    if (failure instanceof AdmissionRefused) {
      throw new RequestInvalid({ reason: 'The mech is not accepting notifications' });
    }

    throw failure;
  });

  await wakeMech({ store, startAdmission, workspaceId: input.workspaceId, mechId: input.mechId });

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

export function createNotificationOperations({ store, startAdmission }: NotificationOperationsInput) {
  return {
    sendNotification: validatedOperation({
      operation: catalog.sendNotification,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });

        return await admitNotification({
          store,
          startAdmission,
          input,
          producer: { kind: 'member', principalId: actor.principalId },
          shouldPublishToConsole: actor.authKind === 'session' && input.source.name === 'console',
        });
      },
    }),
    listConsoleMessages: validatedOperation({
      operation: catalog.listConsoleMessages,
      run: async ({ input, caller }) => {
        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });
        await store.getMech(input);

        const selection: {
          workspaceId: string;
          mechId: string;
          maxRows: number;
          beforeSequence?: number;
          afterSequence?: number;
        } = { workspaceId: input.workspaceId, mechId: input.mechId, maxRows: CONVERSATION_PAGE_MAX_ROWS };

        if (Option.isSome(input.beforeSequence)) {
          selection.beforeSequence = input.beforeSequence.value;
        }

        if (Option.isSome(input.afterSequence)) {
          selection.afterSequence = input.afterSequence.value;
        }

        const page = await store.listConsoleMessages(selection);

        return {
          messages: page.messages.map((message) => ({
            id: message.id,
            mech_id: message.mechId,
            run_id: message.runId,
            role: message.role,
            text: message.text,
            presentation: message.presentation,
            created_at: message.createdAt,
            sequence: message.sequence,
          })),
          has_more: page.hasMore,
          before_sequence: page.beforeSequence,
        };
      },
    }),
  };
}
