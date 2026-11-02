import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { Delivery } from '@mechane/protocol';
import type { Mech } from '@mechane/protocol';
import { Button, Muted, Notice, Panel, Row, Stack, TextArea } from '@mechane/ui';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

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
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (busy || sent) {
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
          setSent(true);
          setBusy(false);
          void data.refresh();
        },
        (cause: unknown) => {
          setError(problemMessage(cause));
          setBusy(false);
        },
      );
  }

  if (sent) {
    return (
      <Panel>
        <Stack>
          <Notice>Message received. It will run when the mech is active and ready.</Notice>
          <Button onClick={onClose}>Done</Button>
        </Stack>
      </Panel>
    );
  }

  return (
    <Panel>
      <form onSubmit={submit}>
        <Stack>
          <TextArea
            label={`Message ${mech.name}`}
            required
            maxLength={65_536}
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value);
              setId(crypto.randomUUID());
              setError(undefined);
            }}
          />
          <Muted>Sending a message may start model requests using this workspace’s allowance.</Muted>
          {error !== undefined && <Notice error>{error}</Notice>}
          <Row>
            <Button type="submit" tone="primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send message'}
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
