import { isRevisionConflict, problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { DefinitionConflict } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Micros } from '@mechane/records';
import { Button, DetailPage, Heading, Muted, Notice, Row, Stack, TextArea, TextField, Toolbar } from '@mechane/ui';
import { Option, Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

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

    if (Number(cap) === original.dailyCapMicros / 1_000_000) {
      setCap(String(mech.dailyCapMicros / 1_000_000));
    }

    setOriginal(mech);
    setConflict(false);
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();

    if (busy || conflict || original.revision !== mech.revision) {
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
      .then(onClose, (cause: unknown) => {
        setBusy(false);

        if (isRevisionConflict(cause)) {
          setConflict(true);
          void data.refresh();
        } else {
          setError(problemMessage(cause));
        }
      });
  }

  return (
    <>
      <Toolbar
        breadcrumb
        title={
          <>
            <Button tone="link" onClick={onClose}>
              {original.name}
            </Button>{' '}
            / Edit definition
          </>
        }
      />
      {notice}
      <DetailPage>
        <Stack>
          <Heading>Edit {original.name}</Heading>
          <Muted>Editing revision {original.revision}.</Muted>
          {(conflict || mech.revision !== original.revision) && (
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
              <TextField
                label="Name"
                required
                maxLength={64}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="Model"
                required
                value={model}
                disabled={busy}
                onChange={(event) => setModel(event.target.value)}
              />
              <TextField
                label="Daily cap (USD)"
                type="number"
                min="0"
                step="0.000001"
                required
                value={cap}
                disabled={busy}
                onChange={(event) => setCap(event.target.value)}
              />
              <TextArea
                label="Instructions"
                maxLength={65_536}
                value={instructions}
                disabled={busy}
                onChange={(event) => setInstructions(event.target.value)}
              />
              {error !== undefined && <Notice error>{error}</Notice>}
              <Row>
                <Button
                  tone="primary"
                  type="submit"
                  disabled={busy || conflict || mech.revision !== original.revision}
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
