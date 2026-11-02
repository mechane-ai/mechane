import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { CreationRequestId } from '@mechane/records';
import { Button, Heading, Muted, Notice, Panel, Row, Stack, TextArea, TextField } from '@mechane/ui';
import { Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

export function CreateMechForm({
  data,
  onCancel,
  onCreated,
}: {
  readonly data: ConsoleData;
  readonly onCancel: () => void;
  readonly onCreated: (id: string) => void;
}): ReactNode {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [requestId, setRequestId] = useState(() => Schema.decodeUnknownSync(CreationRequestId)(crypto.randomUUID()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function changed(): void {
    setRequestId(Schema.decodeUnknownSync(CreationRequestId)(crypto.randomUUID()));
    setError(undefined);
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError(undefined);
    void data
      .api('createMech', {
        workspaceId: data.workspace.id,
        name,
        requestId,
        ...(instructions.trim() === '' ? {} : { instructions }),
      })
      .then(
        (mech) => {
          onCreated(mech.id);
        },
        (cause: unknown) => {
          setError(problemMessage(cause));
          setBusy(false);
        },
      );
  }

  return (
    <Stack>
      <Button tone="quiet" onClick={onCancel}>
        ← Mechs
      </Button>
      <Heading>Create a mech</Heading>
      <Muted>
        The installation’s default model and daily cap apply. You can edit its definition after creating it.
      </Muted>
      <Panel>
        <form onSubmit={submit}>
          <Stack>
            <TextField
              label="Name"
              required
              maxLength={64}
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
                changed();
              }}
              autoFocus
            />
            <TextArea
              label="Instructions"
              maxLength={65_536}
              value={instructions}
              disabled={busy}
              onChange={(event) => {
                setInstructions(event.target.value);
                changed();
              }}
              placeholder="What should this mech do?"
            />
            {error !== undefined && <Notice error>{error}</Notice>}
            <Row>
              <Button type="submit" tone="primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create mech'}
              </Button>
              <Button type="button" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
            </Row>
          </Stack>
        </form>
      </Panel>
    </Stack>
  );
}
