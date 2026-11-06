import { Button, Heading, Muted, Row, Stack, TextButton } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { Field, Input, Textarea } from '@mechane-ai/elements/forms';
import { DetailPage, PageToolbar } from '@mechane-ai/elements/layout';
import type { ConsoleData } from '@mechane/console-data';
import { DefinitionConflict } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import type { ReactNode, SubmitEvent } from 'react';
import { useWorkspaceDrafts } from '../drafts.tsx';

export function EditMechForm({
  data,
  mech,
  onClose,
  notice,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly onClose: () => void;
  readonly notice?: ReactNode;
}): ReactNode {
  const { definition, changeDefinition, continueDefinition, saveDefinition } = useWorkspaceDrafts();

  if (definition === undefined) {
    return null;
  }

  const { original, name, model, instructions, cap, hasRevisionConflict, isPending: isBusy, error } = definition;
  const hasConflict = hasRevisionConflict || original.revision !== mech.revision;

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (!hasConflict) {
      saveDefinition(data);
    }
  }

  return (
    <>
      <PageToolbar
        showBreadcrumb
        title={
          <>
            <TextButton onClick={onClose} disabled={isBusy}>
              {original.name}
            </TextButton>{' '}
            / Edit definition
          </>
        }
      />
      {notice}
      <DetailPage>
        <Stack>
          <Heading>Edit {original.name}</Heading>
          <Muted>Editing revision {original.revision}.</Muted>
          {!isBusy && hasConflict && (
            <DefinitionConflict
              saved={mech.revision === original.revision ? undefined : mech}
              onRefresh={() => {
                void Promise.allSettled([data.refresh(data.reads.mech(mech.id))]);
              }}
              onContinue={() => continueDefinition(mech)}
            />
          )}
          <form onSubmit={submit}>
            <Stack>
              <Field.Root name="name" disabled={isBusy}>
                <Field.Label>Name</Field.Label>
                <Input
                  required
                  maxLength={64}
                  value={name}
                  onChange={(event) => changeDefinition({ name: event.target.value })}
                />
                <Field.Error />
              </Field.Root>
              <Field.Root name="model" disabled={isBusy}>
                <Field.Label>Model</Field.Label>
                <Input required value={model} onChange={(event) => changeDefinition({ model: event.target.value })} />
                <Field.Error />
              </Field.Root>
              <Field.Root name="dailyCap" disabled={isBusy}>
                <Field.Label>Daily cap (USD)</Field.Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  required
                  value={cap}
                  onChange={(event) => changeDefinition({ cap: event.target.value })}
                />
                <Field.Description>Maximum daily model spend for this mech.</Field.Description>
                <Field.Error />
              </Field.Root>
              <Field.Root name="instructions" disabled={isBusy}>
                <Field.Label>Instructions</Field.Label>
                <Textarea
                  maxLength={65_536}
                  value={instructions}
                  onChange={(event) => changeDefinition({ instructions: event.target.value })}
                />
                <Field.Error />
              </Field.Root>
              {error !== undefined && <Notice hasError>{error}</Notice>}
              <Row>
                <Button
                  variant="solid"
                  type="submit"
                  disabled={isBusy || hasConflict}
                  isPending={isBusy}
                  pendingLabel="Saving…"
                >
                  Save definition
                </Button>
                <Button type="button" disabled={isBusy} onClick={onClose}>
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
