import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure, OperationCall } from '@mechane/client';
import { PROGRAM } from '@mechane/commands';
import type { CommandInput } from '@mechane/commands';
import type { WorkspaceAccess } from '@mechane/eval';
import { writeDiagnostic } from '@mechane/program';
import { NotificationId } from '@mechane/protocol';
import type { NotificationReceipt } from '@mechane/protocol';
import { DateTime, Effect } from 'effect';
import { withWorkspace } from './with-workspace.ts';

type SendNotificationInput = {
  readonly call: OperationCall<'sendNotification'>;
  readonly access: WorkspaceAccess;
  readonly input: CommandInput<'notification send'>;
  readonly notificationId: NotificationId;
};

export const runNotificationSend = Effect.fn('runNotificationSend')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'notification send'>): Effect.fn.Return<CommandResult<'notification send'>, RunFailure> {
  const { notificationId = NotificationId.make(crypto.randomUUID()) } = input;

  const send: (access: WorkspaceAccess) => Effect.Effect<NotificationReceipt, ClientFailure> = (access) =>
    sendNotification({ call, access, input, notificationId });

  const received = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use: send });
  const time = DateTime.formatIso(received.receivedAt);

  return { lines: [`${received.id} received at ${time}`], result: received };
});

const sendNotification = Effect.fn('sendNotification')(function* ({
  call,
  access,
  input,
  notificationId,
}: SendNotificationInput): Effect.fn.Return<NotificationReceipt, ClientFailure> {
  const { token, workspaceId } = access;

  // Printing before transport makes an uncertain send retryable without a second notification.
  writeDiagnostic({
    program: PROGRAM,
    line: `sending notification ${notificationId}; retry the same text with --notification-id ${notificationId}`,
  });

  return yield* call({
    name: 'sendNotification',
    input: {
      workspaceId,
      mechId: input.mechId,
      notificationId,
      text: input.text,
      source: { name: 'cli', eventId: notificationId },
    },
    credential: token,
  });
});
