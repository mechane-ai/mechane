import { isRevisionConflict, problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Delivery } from '@mechane/protocol';
import type { InboxItem, Mech, Turn } from '@mechane/protocol';
import { CreationRequestId, Micros } from '@mechane/records';
import { Option, Schema } from 'effect';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type MessageSubmission = {
  readonly id: string;
  readonly text: string;
  readonly isPending: boolean;
  readonly error: string | undefined;
};

type MessageDraft = {
  readonly id: string;
  readonly text: string;
  readonly submission: MessageSubmission | undefined;
  readonly received: Pick<InboxItem, 'id'> | undefined;
  readonly outcome: MessageRunReceipt | undefined;
};

export type MessageRunReceipt = {
  readonly turnId: Turn['id'];
  readonly status: Turn['status'];
  readonly wasCanceled: boolean;
};

type DefinitionDraft = {
  readonly id: string;
  readonly original: Mech;
  readonly name: string;
  readonly model: string;
  readonly instructions: string;
  readonly cap: string;
  readonly hasRevisionConflict: boolean;
  readonly isPending: boolean;
  readonly error: string | undefined;
};

type CreatedMech = Pick<Mech, 'id' | 'name'>;

type CreationDraft = {
  readonly name: string;
  readonly instructions: string;
  readonly requestId: CreationRequestId;
  readonly isPending: boolean;
  readonly error: string | undefined;
  readonly created: CreatedMech | undefined;
};

type DraftState = {
  readonly mechId: string | undefined;
  readonly message: MessageDraft;
  readonly definition: DefinitionDraft | undefined;
  readonly creation: CreationDraft | undefined;
};

type DraftOwner = {
  readonly message: MessageDraft;
  readonly definition: DefinitionDraft | undefined;
  readonly creation: CreationDraft | undefined;
  readonly changeMessage: (text: string) => void;
  readonly sendMessage: (data: ConsoleData, mech: Mech, shouldRetry?: boolean) => void;
  readonly observeMessageTurn: (inboxItemId: InboxItem['id'], turn: Turn | undefined) => void;
  readonly openDefinition: (mech: Mech) => void;
  readonly closeDefinition: () => void;
  readonly changeDefinition: (
    changes: Partial<Pick<DefinitionDraft, 'name' | 'model' | 'instructions' | 'cap'>>,
  ) => void;
  readonly continueDefinition: (mech: Mech) => void;
  readonly saveDefinition: (data: ConsoleData) => void;
  readonly openCreation: () => void;
  readonly closeCreation: () => void;
  readonly changeCreation: (changes: Partial<Pick<CreationDraft, 'name' | 'instructions'>>) => void;
  readonly createMech: (data: ConsoleData) => Promise<CreatedMech | undefined>;
};

const DraftContext = createContext<DraftOwner | undefined>(undefined);

function emptyDrafts(mechId: string | undefined): DraftState {
  return {
    mechId,
    message: { id: crypto.randomUUID(), text: '', submission: undefined, received: undefined, outcome: undefined },
    definition: undefined,
    creation: undefined,
  };
}

export function WorkspaceDraftProvider({
  mechId,
  children,
}: {
  readonly mechId: string | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const [saved, setSaved] = useState(() => emptyDrafts(mechId));
  const state = saved.mechId === mechId ? saved : emptyDrafts(mechId);

  if (state !== saved) {
    setSaved(state);
  }

  function update(change: (current: DraftState) => DraftState): void {
    setSaved((current) => (current.mechId === mechId ? change(current) : current));
  }

  function changeMessage(text: string): void {
    update((current) => ({
      ...current,
      message: { ...current.message, id: crypto.randomUUID(), text, received: undefined, outcome: undefined },
    }));
  }

  function sendMessage(data: ConsoleData, mech: Mech, shouldRetry = false): void {
    const draft = state.message;

    if (draft.submission?.isPending === true || mech.status === 'archived') {
      return;
    }

    const submitted = shouldRetry && draft.submission !== undefined ? draft.submission : draft;

    if (submitted.text.trim().length === 0) {
      return;
    }

    const submission = { id: submitted.id, text: submitted.text, isPending: true, error: undefined };

    update((current) => ({ ...current, message: { ...current.message, submission } }));

    void data.commands
      .sendInboxItem({
        mechId: mech.id,
        inboxItemId: submission.id,
        text: submission.text,
        delivery: Delivery.WhenIdle,
      })
      .then(
        (received) => {
          update((current) => {
            if (current.message.submission?.id !== submission.id) {
              return current;
            }

            const isSubmittedDraft = current.message.id === submission.id;

            return {
              ...current,
              message: {
                id: isSubmittedDraft ? crypto.randomUUID() : current.message.id,
                text: isSubmittedDraft ? '' : current.message.text,
                submission: undefined,
                received: { id: received.id },
                outcome: undefined,
              },
            };
          });
        },
        (cause: unknown) => {
          update((current) =>
            current.message.submission?.id === submission.id
              ? {
                  ...current,
                  message: {
                    ...current.message,
                    submission: { ...submission, isPending: false, error: problemMessage(cause) },
                  },
                }
              : current,
          );
        },
      );
  }

  function observeMessageTurn(inboxItemId: InboxItem['id'], turn: Turn | undefined): void {
    update((current) => {
      if (current.message.received?.id !== inboxItemId) {
        return current;
      }

      const prior = current.message.outcome;

      if (turn === undefined) {
        return prior === undefined ? current : { ...current, message: { ...current.message, outcome: undefined } };
      }

      const wasCanceled = turn.status === 'unanswered' && turn.reason === 'canceled';

      const hasSameOutcome =
        prior?.turnId === turn.id && prior.status === turn.status && prior.wasCanceled === wasCanceled;

      const wouldRegress = prior?.turnId === turn.id && prior.status !== 'running' && turn.status === 'running';

      if (hasSameOutcome || wouldRegress) {
        return current;
      }

      return {
        ...current,
        message: { ...current.message, outcome: { turnId: turn.id, status: turn.status, wasCanceled } },
      };
    });
  }

  function openDefinition(mech: Mech): void {
    update((current) => ({
      ...current,
      definition: {
        id: crypto.randomUUID(),
        original: mech,
        name: mech.name,
        model: mech.model,
        instructions: Option.getOrElse(mech.instructions, () => ''),
        cap: String(mech.dailyCapMicros / 1_000_000),
        hasRevisionConflict: false,
        isPending: false,
        error: undefined,
      },
    }));
  }

  function closeDefinition(): void {
    update((current) => (current.definition?.isPending === true ? current : { ...current, definition: undefined }));
  }

  function changeDefinition(changes: Partial<Pick<DefinitionDraft, 'name' | 'model' | 'instructions' | 'cap'>>): void {
    update((current) =>
      current.definition === undefined
        ? current
        : { ...current, definition: { ...current.definition, ...changes, error: undefined } },
    );
  }

  function continueDefinition(mech: Mech): void {
    update((current) => {
      const draft = current.definition;

      if (draft === undefined) {
        return current;
      }

      return {
        ...current,
        definition: {
          ...draft,
          original: mech,
          name: draft.name === draft.original.name ? mech.name : draft.name,
          model: draft.model === draft.original.model ? mech.model : draft.model,
          instructions:
            draft.instructions === Option.getOrElse(draft.original.instructions, () => '')
              ? Option.getOrElse(mech.instructions, () => '')
              : draft.instructions,
          cap:
            draft.cap === String(draft.original.dailyCapMicros / 1_000_000)
              ? String(mech.dailyCapMicros / 1_000_000)
              : draft.cap,
          hasRevisionConflict: false,
        },
      };
    });
  }

  function saveDefinition(data: ConsoleData): void {
    const draft = state.definition;

    if (draft === undefined || draft.isPending || draft.hasRevisionConflict) {
      return;
    }

    const amount = Math.round(Number(draft.cap) * 1_000_000);

    if (!Schema.is(Micros)(amount)) {
      update((current) => ({ ...current, definition: { ...draft, error: 'Enter a valid daily cap.' } }));

      return;
    }

    update((current) => ({ ...current, definition: { ...draft, isPending: true, error: undefined } }));
    void data.commands
      .updateMech({
        mechId: draft.original.id,
        expectedRevision: draft.original.revision,
        name: draft.name,
        model: draft.model,
        instructions: draft.instructions === '' ? Option.none() : Option.some(draft.instructions),
        dailyCapMicros: amount,
      })
      .then(
        () => {
          update((current) => (current.definition?.id === draft.id ? { ...current, definition: undefined } : current));
        },
        (cause: unknown) => {
          update((current) =>
            current.definition?.id === draft.id
              ? {
                  ...current,
                  definition: {
                    ...current.definition,
                    isPending: false,
                    hasRevisionConflict: isRevisionConflict(cause),
                    error: isRevisionConflict(cause) ? undefined : problemMessage(cause),
                  },
                }
              : current,
          );
        },
      );
  }

  function openCreation(): void {
    update((current) => ({
      ...current,
      creation: {
        name: '',
        instructions: '',
        requestId: Schema.decodeUnknownSync(CreationRequestId)(crypto.randomUUID()),
        isPending: false,
        error: undefined,
        created: undefined,
      },
    }));
  }

  function closeCreation(): void {
    update((current) => (current.creation?.isPending === true ? current : { ...current, creation: undefined }));
  }

  function changeCreation(changes: Partial<Pick<CreationDraft, 'name' | 'instructions'>>): void {
    update((current) =>
      current.creation === undefined
        ? current
        : {
            ...current,
            creation: {
              ...current.creation,
              ...changes,
              requestId: Schema.decodeUnknownSync(CreationRequestId)(crypto.randomUUID()),
              error: undefined,
            },
          },
    );
  }

  async function createMech(data: ConsoleData): Promise<CreatedMech | undefined> {
    const draft = state.creation;

    if (draft === undefined || draft.isPending) {
      return undefined;
    }

    if (draft.created !== undefined) {
      return draft.created;
    }

    update((current) => ({ ...current, creation: { ...draft, isPending: true, error: undefined } }));

    return await data.commands
      .createMech({
        name: draft.name,
        requestId: draft.requestId,
        ...(draft.instructions.trim() === '' ? {} : { instructions: draft.instructions }),
      })
      .then(
        (mech) => {
          const created = { id: mech.id, name: mech.name };

          update((current) =>
            current.creation?.requestId === draft.requestId
              ? { ...current, creation: { ...current.creation, isPending: false, created } }
              : current,
          );

          return created;
        },
        (cause: unknown): undefined => {
          update((current) =>
            current.creation?.requestId === draft.requestId
              ? { ...current, creation: { ...draft, isPending: false, error: problemMessage(cause) } }
              : current,
          );

          return undefined;
        },
      );
  }

  return (
    <DraftContext
      value={{
        message: state.message,
        definition: state.definition,
        creation: state.creation,
        changeMessage,
        sendMessage,
        observeMessageTurn,
        openDefinition,
        closeDefinition,
        changeDefinition,
        continueDefinition,
        saveDefinition,
        openCreation,
        closeCreation,
        changeCreation,
        createMech,
      }}
    >
      {children}
    </DraftContext>
  );
}

export function useWorkspaceDrafts(): DraftOwner {
  const drafts = useContext(DraftContext);

  if (drafts === undefined) {
    throw new Error('Workspace drafts need an admitted workspace.');
  }

  return drafts;
}
