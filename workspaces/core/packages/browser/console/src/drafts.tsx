import { problemMessage } from '@mechane/console-data';
import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Submission = { readonly isPending: boolean; readonly error?: string };
type MessageDraft = { readonly text: string; readonly submission?: Submission };

type DraftOwner = {
  readonly message: MessageDraft;
  readonly changeMessage: (text: string) => void;
  readonly sendMessage: (canSend: boolean, send: (message: { readonly text: string }) => Promise<unknown>) => void;
};

const DraftContext = createContext<DraftOwner | undefined>(undefined);
const empty: MessageDraft = { text: '' };

export function WorkspaceDraftProvider({
  scope,
  children,
}: {
  readonly scope: string | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, MessageDraft>>(() => new Map());
  const latest = useRef(drafts);
  const message = scope === undefined ? empty : (drafts.get(scope) ?? empty);

  function save(key: string, draft: MessageDraft): void {
    const next = new Map(latest.current);

    if (draft.text === '' && draft.submission === undefined) {
      next.delete(key);
    } else {
      next.set(key, draft);
    }

    latest.current = next;

    setDrafts(next);
  }

  function changeMessage(text: string): void {
    if (scope === undefined) {
      return;
    }

    const current = latest.current.get(scope);

    save(scope, current?.submission?.isPending === true ? { ...current, text } : { text });
  }

  function sendMessage(canSend: boolean, send: (message: { readonly text: string }) => Promise<unknown>): void {
    if (scope === undefined || !canSend) {
      return;
    }

    const draft = latest.current.get(scope);

    if (draft === undefined || draft.submission?.isPending === true || draft.text.trim() === '') {
      return;
    }

    const submitted = { text: draft.text, submission: { isPending: true } };

    save(scope, submitted);

    void Promise.resolve()
      .then(() => send({ text: submitted.text }))
      .then(
        () => {
          const current = latest.current.get(scope);

          if (current?.submission === submitted.submission) {
            save(scope, current === submitted ? empty : { text: current.text });
          }
        },
        (problem: unknown) => {
          const current = latest.current.get(scope);

          if (current?.submission === submitted.submission) {
            save(scope, { text: current.text, submission: { isPending: false, error: problemMessage(problem) } });
          }
        },
      );
  }

  return <DraftContext value={{ message, changeMessage, sendMessage }}>{children}</DraftContext>;
}

export function useWorkspaceDrafts(): DraftOwner {
  const drafts = useContext(DraftContext);

  if (drafts === undefined) {
    throw new Error('Workspace drafts need an admitted workspace.');
  }

  return drafts;
}
