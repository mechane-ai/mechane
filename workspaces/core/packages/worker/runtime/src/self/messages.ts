import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { LiveDoc } from '@earendil-works/pi-durable';
import type { ConversationId, Tx } from '@earendil-works/pi-durable';
import { StoreConflict } from '@mechane/control-store';
import { MechArchived, RequestInvalid, WorkspaceSuspended } from '@mechane/protocol';
import { createPresentationOutput } from '@mechane/protocol/presentation';
import { MechId, WorkspaceId } from '@mechane/records';
import type { MechScope, PublishMessageInput } from '../actor/client.ts';
import { ImportedHistory, ImportedMessagePointers, Messages } from '../actor/collections.ts';
import { stableJson, State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import type { ConsoleMessage } from '../domain.ts';
import { appendEvent, turnForNativeInputs } from '../notifications/admission.ts';
import { ToolNotStartedError } from '../tools/errors.ts';
import { importedMessages } from '../views/imported.ts';

const CONSOLE_MESSAGE_MAX_CHARACTERS = 65_536;

type PublicationAdmission = { readonly isCurrent: (transaction: Tx) => Promise<boolean> };

async function readPublishedMessage(
  transaction: Tx,
  scope: MechScope,
  messageId: string,
): Promise<ConsoleMessage | undefined> {
  const importedKey = await ImportedMessagePointers.read(transaction, messageId);

  if (importedKey !== undefined) {
    const entry = await ImportedHistory.read(transaction, importedKey);

    if (entry === undefined) {
      throw new Error('The imported message index has no retained record');
    }

    const message = importedMessages([entry], scope).find((candidate) => candidate.id === messageId);

    if (message === undefined) {
      throw new Error('The imported message index has another identity');
    }

    return message;
  }

  return await Messages.read(transaction, messageId);
}

async function currentTurnId(transaction: Tx, conversationId: ConversationId): Promise<string | null> {
  const live = await transaction.doc(LiveDoc, conversationId);

  if (live.run === undefined) {
    return null;
  }

  const turn = await turnForNativeInputs(transaction, live.run.inputs);

  return turn.id;
}

export async function publishMessage(
  access: ActorAccess,
  input: PublishMessageInput,
  admission?: PublicationAdmission,
): Promise<ConsoleMessage> {
  if (input.text.length === 0 || input.text.length > CONSOLE_MESSAGE_MAX_CHARACTERS) {
    throw new Error('The console message exceeds its text limit');
  }

  const presentation: ConsoleMessage['presentation'] = (() => {
    if (input.presentation === undefined) {
      return null;
    }

    return createPresentationOutput({ spec: input.presentation });
  })();

  return await access.harness.commit(async (transaction) => {
    const state = await transaction.doc(State);

    const existing = await readPublishedMessage(transaction, access.scope, input.messageId);

    if (existing !== undefined) {
      if (existing.text !== input.text || stableJson(existing.presentation) !== stableJson(presentation)) {
        throw new StoreConflict('The console message identity has different content');
      }

      return existing;
    }

    if (state.isQuiesced || !state.isImportComplete) {
      throw new RequestInvalid({ reason: 'The mech is quiesced' });
    }

    if (admission !== undefined && !(await admission.isCurrent(transaction))) {
      throw new ToolNotStartedError('The originating generation no longer permits publication.');
    }

    const runId = await currentTurnId(transaction, access.conversation.id);
    const total = await Messages.totalInTransaction(transaction);

    const message: ConsoleMessage = {
      ...access.scope,
      id: input.messageId,
      runId,
      sequence: state.messageBaseSequence + total + 1,
      role: 'assistant',
      text: input.text,
      presentation,
      createdAt: new Date().toISOString(),
    };

    await Messages.put(transaction, message.id, message);
    await appendEvent(transaction, {
      type: 'console.message',
      runId: message.runId,
      payload: { messageId: message.id },
    });

    return message;
  }, BACKGROUND_CONTEXT);
}

export async function publishSelfMessage(access: ActorAccess, input: PublishMessageInput): Promise<ConsoleMessage> {
  return await publishMessage(access, input, {
    isCurrent: async () =>
      await access.withControl(async (store) => {
        const mech = await store.getMech(access.scope);
        const policy = await store.getRuntimePolicy(access.scope);

        if (policy === null || policy.isSuspended) {
          throw new WorkspaceSuspended({ workspaceId: WorkspaceId.make(access.scope.workspaceId) });
        }

        if (mech.status === 'archived') {
          throw new MechArchived({ mechId: MechId.make(access.scope.mechId) });
        }

        return true;
      }),
  });
}
