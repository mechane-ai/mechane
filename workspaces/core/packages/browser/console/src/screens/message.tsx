import { Button, Muted, Panel, Row, Stack } from '@mechane-ai/elements';
import { PromptInput } from '@mechane-ai/elements/ai';
import { Notice } from '@mechane-ai/elements/feedback';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Delivery, INBOX_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { InboxItem, Mech, Turn } from '@mechane/protocol';
import { useEffect, useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

function MessageReceipt({
  data,
  mech,
  receipt,
  onClose,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly receipt: InboxItem;
  readonly onClose: () => void;
}): ReactNode {
  const [turn, setTurn] = useState<Turn['id']>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void data.messageTurn(mech.id, receipt, controller.signal).then(
      (id) => {
        if (!controller.signal.aborted) {
          setTurn(id);
        }
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(problemMessage(cause));
        }
      },
    );

    return () => controller.abort();
  }, [data, mech.id, receipt, attempt]);

  return (
    <Panel>
      <Stack compact>
        <strong role="status">Message received</strong>
        {turn === undefined ? (
          <Muted>
            {mech.status === 'paused'
              ? 'Queued until you activate this mech.'
              : 'Waiting for the mech to take up this message.'}
          </Muted>
        ) : (
          <Row>
            <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn }}>View turn →</ConsoleLink>
          </Row>
        )}
        {error !== undefined && (
          <Notice error>
            {error}{' '}
            <Button
              onClick={() => {
                setError(undefined);
                setAttempt((v) => v + 1);
              }}
            >
              Retry tracking
            </Button>
          </Notice>
        )}
        <Row>
          <Button onClick={onClose}>Done</Button>
        </Row>
      </Stack>
    </Panel>
  );
}

export function MessageForm({
  data,
  mech,
  onClose,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly onClose: () => void;
}): ReactNode {
  const [text, setText] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<InboxItem>();
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (busy || receipt !== undefined) {
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
        (received) => {
          if (isScreenActive()) {
            setReceipt(received);
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

  if (receipt !== undefined) {
    return <MessageReceipt data={data} mech={mech} receipt={receipt} onClose={onClose} />;
  }

  return (
    <Panel>
      <PromptInput
        name="message"
        label={`Message ${mech.name}`}
        value={text}
        onValueChange={(value) => {
          setText(value);
          setId(crypto.randomUUID());
          setError(undefined);
        }}
        onSubmit={submit}
        maxLength={INBOX_TEXT_MAX_CHARS}
        pending={busy}
        submitLabel="Send message"
        enterBehavior="newline"
        description="Sending a message may start model requests using this workspace’s allowance."
        error={error}
        controls={
          <Button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        }
      />
    </Panel>
  );
}
