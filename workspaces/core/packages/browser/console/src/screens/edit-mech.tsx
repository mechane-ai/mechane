import { isRevisionConflict, problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { DefinitionConflict } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import { Button, Field, Heading, Input, Muted, Notice, Row, Stack, Textarea, TextButton } from '@mechane/ui';
import { DetailPage, PageToolbar } from '@mechane/ui-layout';
import { Option, Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

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
  const [original, setOriginal] = useState(mech);
  const [conflict, setConflict] = useState(false);
  const [name, setName] = useState(mech.name);
  const [model, setModel] = useState(mech.model);
  const [instructions, setInstructions] = useState(Option.getOrElse(mech.instructions, () => ''));
  const [cap, setCap] = useState(String(mech.dailyCapMicros / 1_000_000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();
  const hasConflict = conflict || original.revision !== mech.revision;

  function continueDraft(): void {
    if (name === original.name) {
      setName(mech.name);
    }

    if (model === original.model) {
      setModel(mech.model);
    }

    if (instructions === Option.getOrElse(original.instructions, () => '')) {
      setInstructions(Option.getOrElse(mech.instructions, () => ''));
    }

    if (cap === String(original.dailyCapMicros / 1_000_000)) {
      setCap(String(mech.dailyCapMicros / 1_000_000));
    }

    setOriginal(mech);
    setConflict(false);
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (busy || hasConflict) {
      return;
    }

    setBusy(true);
    setError(undefined);

    const amount = Math.round(Number(cap) * 1_000_000);

    if (!Schema.is(Micros)(amount)) {
      setBusy(false);
      setError('Enter a valid daily cap.');

      return;
    }

    void data
      .update(original, {
        name,
        model,
        instructions: instructions === '' ? Option.none() : Option.some(instructions),
        dailyCapMicros: amount,
      })
      .then(
        () => {
          if (isScreenActive()) {
            onClose();
          }
        },
        (cause: unknown) => {
          if (!isScreenActive()) {
            return;
          }

          setBusy(false);

          if (isRevisionConflict(cause)) {
            setConflict(true);
            void data.refresh();
          } else {
            setError(problemMessage(cause));
          }
        },
      );
  }

  return (
    <>
      <PageToolbar
        breadcrumb
        title={
          <>
            <TextButton onClick={onClose}>{original.name}</TextButton> / Edit definition
          </>
        }
      />
      {notice}
      <DetailPage>
        <Stack>
          <Heading>Edit {original.name}</Heading>
          <Muted>Editing revision {original.revision}.</Muted>
          {!busy && hasConflict && (
            <DefinitionConflict
              saved={mech.revision === original.revision ? undefined : mech}
              onRefresh={() => {
                void data.refresh();
              }}
              onContinue={continueDraft}
            />
          )}
          <form onSubmit={submit}>
            <Stack>
              <Field.Root name="name" disabled={busy}>
                <Field.Label>Name</Field.Label>
                <Input required maxLength={64} value={name} onChange={(event) => setName(event.target.value)} />
                <Field.Error />
              </Field.Root>
              <Field.Root name="model" disabled={busy}>
                <Field.Label>Model</Field.Label>
                <Input required value={model} onChange={(event) => setModel(event.target.value)} />
                <Field.Error />
              </Field.Root>
              <Field.Root name="dailyCap" disabled={busy}>
                <Field.Label>Daily cap (USD)</Field.Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  required
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                />
                <Field.Description>Maximum daily model spend for this mech.</Field.Description>
                <Field.Error />
              </Field.Root>
              <Field.Root name="instructions" disabled={busy}>
                <Field.Label>Instructions</Field.Label>
                <Textarea
                  maxLength={65_536}
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
                <Field.Error />
              </Field.Root>
              {error !== undefined && <Notice error>{error}</Notice>}
              <Row>
                <Button
                  variant="solid"
                  type="submit"
                  disabled={busy || hasConflict}
                  pending={busy}
                  pendingLabel="Saving…"
                >
                  Save definition
                </Button>
                <Button type="button" disabled={busy} onClick={onClose}>
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
