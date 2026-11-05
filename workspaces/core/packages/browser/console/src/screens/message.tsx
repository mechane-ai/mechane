import { Muted } from '@mechane-ai/elements';
import { PromptInput } from '@mechane-ai/elements/ai';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Delivery, INBOX_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

export function MessageForm({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const [text, setText] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (busy || text.trim().length === 0 || mech.status === 'archived') {
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
        () => {
          if (isScreenActive()) {
            setText('');
            setId(crypto.randomUUID());
            setReceived(true);
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
      compact
      name="message"
      label={`Message ${mech.name}`}
      placeholder="What should we work on?"
      value={text}
      onValueChange={(value) => {
        setText(value);
        setId(crypto.randomUUID());
        setError(undefined);
        setReceived(false);
      }}
      onSubmit={submit}
      maxLength={INBOX_TEXT_MAX_CHARS}
      pending={busy}
      disabled={mech.status === 'archived'}
      submitDisabled={text.trim().length === 0}
      enterBehavior="submit"
      error={error}
      controls={
        <Muted>
          {received
            ? mech.status === 'paused'
              ? 'Received · queued while paused'
              : 'Received · queued for the next run'
            : 'Enter to send · Shift + Enter for a new line'}
        </Muted>
      }
    />
  );
}
