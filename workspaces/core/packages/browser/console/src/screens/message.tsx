import { PromptInput } from '@mechane-ai/elements/ai';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Delivery, INBOX_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { InboxItem, Mech } from '@mechane/protocol';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { ConversationActivity } from './conversation-activity.tsx';

export function MessageForm({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const [text, setText] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  const [isBusy, setBusy] = useState(false);
  const [received, setReceived] = useState<InboxItem>();
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (isBusy || text.trim().length === 0 || mech.status === 'archived') {
      return;
    }

    setBusy(true);
    setError(undefined);
    void data
      .api('sendInboxItem', {
        workspaceId: data.workspace.id,
        mechId: mech.id,
        inboxItemId: id,
        text,
        delivery: Delivery.WhenIdle,
      })
      .then(
        (item) => {
          if (isScreenActive()) {
            setText('');
            setId(crypto.randomUUID());
            setReceived(item);
            setBusy(false);
            void data.refresh();
          }
        },
        (cause: unknown) => {
          if (isScreenActive()) {
            setError(problemMessage(cause));
            setBusy(false);
          }
        },
      );
  }

  return (
    <PromptInput
      isCompact
      name="message"
      label={`Message ${mech.name}`}
      placeholder={`Message ${mech.name}…`}
      value={text}
      onValueChange={(value) => {
        setText(value);
        setId(crypto.randomUUID());
        setError(undefined);
        setReceived(undefined);
      }}
      onSubmit={submit}
      maxLength={INBOX_TEXT_MAX_CHARS}
      isPending={isBusy}
      disabled={mech.status === 'archived'}
      isSubmitDisabled={text.trim().length === 0}
      enterBehavior="submit"
      error={error}
      controls={<ConversationActivity data={data} mech={mech} received={received} />}
    />
  );
}
