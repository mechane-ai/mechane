import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { ClientFailure, OperationCall } from '@mechane/client';
import { PROGRAM } from '@mechane/commands';
import type { CommandInput } from '@mechane/commands';
import type { WorkspaceAccess } from '@mechane/eval';
import { writeDiagnostic } from '@mechane/program';
import { Delivery } from '@mechane/protocol';
import type { InboxItem } from '@mechane/protocol';
import { InboxItemId } from '@mechane/records';
import { DateTime, Effect } from 'effect';
import { withWorkspace } from './with-workspace.ts';

/** An inbox item to send under its id, and its send. */
type SentItemInput = {
  readonly call: OperationCall<'sendInboxItem'>;
  readonly access: WorkspaceAccess;
  readonly input: CommandInput<'inbox send'>;
  readonly inboxItemId: InboxItemId;
};

/**
 * Sends text to a mech's inbox under the given id or a fresh one, which it prints before it posts. A send whose answer
 * is lost can be repeated with `--inbox-item-id` and the same text, and the mech receives the item once.
 */
export const runInboxSend = Effect.fn('runInboxSend')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'inbox send'>): Effect.fn.Return<CommandResult<'inbox send'>, RunFailure> {
  const { inboxItemId = InboxItemId.make(crypto.randomUUID()) } = input;

  const send: (access: WorkspaceAccess) => Effect.Effect<InboxItem, ClientFailure> = (access) =>
    sentItem({ call, access, input, inboxItemId });

  const received = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use: send });
  const time = DateTime.formatIso(received.receivedAt);

  return {
    lines: [`${received.id} received at ${time} as event ${received.receivedSequence} for ${received.delivery}`],
    result: received,
  };
});

/** Prints how to repeat the send under the item's id, then sends it. */
const sentItem = Effect.fn('sentItem')(function* ({
  call,
  access,
  input,
  inboxItemId,
}: SentItemInput): Effect.fn.Return<InboxItem, ClientFailure> {
  const { token, workspaceId } = access;

  writeDiagnostic({
    program: PROGRAM,
    line: `sending inbox item ${inboxItemId}; if no answer comes, send it again with --inbox-item-id ${inboxItemId}`,
  });

  return yield* call({
    name: 'sendInboxItem',
    input: { ...input, workspaceId, inboxItemId, delivery: Delivery.WhenIdle },
    credential: token,
  });
});
