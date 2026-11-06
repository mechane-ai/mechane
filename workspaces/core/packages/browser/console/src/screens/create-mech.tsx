import { Button, Heading, Muted, Row, Stack, TextButton } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { Field, Input, Textarea } from '@mechane-ai/elements/forms';
import { DetailPage, PageToolbar } from '@mechane-ai/elements/layout';
import type { ConsoleData } from '@mechane/console-data';
import type { ReactNode, SubmitEvent } from 'react';
import { useWorkspaceDrafts } from '../drafts.tsx';
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
  const { creation, changeCreation, createMech } = useWorkspaceDrafts();
  const isScreenActive = useScreenLifetime();

  if (creation === undefined) {
    return null;
  }

  const { name, instructions, isPending: isBusy, error, created } = creation;

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    void createMech(data).then((mech) => {
      if (mech !== undefined && isScreenActive()) {
        onCreated(mech.id);
      }
    });
  }

  if (created !== undefined) {
    return (
      <>
        <PageToolbar title="Mech created" />
        <DetailPage>
          <Stack>
            <Heading>{created.name} is ready</Heading>
            <Button onClick={() => onCreated(created.id)}>Open mech</Button>
          </Stack>
        </DetailPage>
      </>
    );
  }

  return (
    <>
      <PageToolbar
        showBreadcrumb
        title={
          <>
            <TextButton onClick={onCancel} disabled={isBusy}>
              Mechs
            </TextButton>{' '}
            / Create
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
                  onChange={(event) => changeCreation({ name: event.target.value })}
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
                  onChange={(event) => changeCreation({ instructions: event.target.value })}
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
