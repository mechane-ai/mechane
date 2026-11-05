import { Button, Heading, Muted, Row, Stack, TextButton } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { Field, Input, Textarea } from '@mechane-ai/elements/forms';
import { DetailPage, PageToolbar } from '@mechane-ai/elements/layout';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { CreationRequestId } from '@mechane/records';
import { Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

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
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();

  function changed(): void {
    setRequestId(Schema.decodeUnknownSync(CreationRequestId)(crypto.randomUUID()));
    setError(undefined);
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (isBusy) {
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
          if (isScreenActive()) {
            onCreated(mech.id);
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
    <>
      <PageToolbar
        showBreadcrumb
        title={
          <>
            <TextButton onClick={onCancel}>Mechs</TextButton> / Create
          </>
        }
      />
      <DetailPage>
        <Stack>
          <Heading>Create a mech</Heading>
          <Muted>
            The installation’s default model and daily cap apply. You can edit its definition after creating it.
          </Muted>
          <form onSubmit={submit}>
            <Stack>
              <Field.Root name="name" disabled={isBusy}>
                <Field.Label>Name</Field.Label>
                <Input
                  required
                  maxLength={64}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    changed();
                  }}
                  autoFocus
                />
                <Field.Description>A name people can recognize in this workspace.</Field.Description>
                <Field.Error />
              </Field.Root>
              <Field.Root name="instructions" disabled={isBusy}>
                <Field.Label>Instructions</Field.Label>
                <Textarea
                  maxLength={65_536}
                  value={instructions}
                  onChange={(event) => {
                    setInstructions(event.target.value);
                    changed();
                  }}
                  placeholder="What should this mech do?"
                />
                <Field.Description>Optional guidance for this mech’s work.</Field.Description>
                <Field.Error />
              </Field.Root>
              {error !== undefined && <Notice hasError>{error}</Notice>}
              <Row>
                <Button type="submit" variant="solid" isPending={isBusy} pendingLabel="Creating…">
                  Create mech
                </Button>
                <Button type="button" onClick={onCancel} disabled={isBusy}>
                  Cancel
                </Button>
              </Row>
            </Stack>
          </form>
        </Stack>
      </DetailPage>
    </>
  );
}
