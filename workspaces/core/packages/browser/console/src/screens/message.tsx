import { Button, Field, Muted, Notice, Panel, Row, Stack, Textarea } from '@mechane-ai/ui';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Delivery } from '@mechane/protocol';
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
      <form onSubmit={submit}>
        <Stack>
          <Field.Root name="message" disabled={busy}>
            <Field.Label>Message {mech.name}</Field.Label>
            <Textarea
              required
              maxLength={65_536}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setId(crypto.randomUUID());
                setError(undefined);
              }}
            />
            <Field.Description>
              Sending a message may start model requests using this workspace’s allowance.
            </Field.Description>
            <Field.Error />
          </Field.Root>
          {error !== undefined && <Notice error>{error}</Notice>}
          <Row>
            <Button type="submit" variant="solid" pending={busy} pendingLabel="Sending…">
              Send message
            </Button>
            <Button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </Row>
        </Stack>
      </form>
    </Panel>
  );
}
