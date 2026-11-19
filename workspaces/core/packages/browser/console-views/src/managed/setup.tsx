import { Button, Row, Stack } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { Field, Input, Textarea } from '@mechane-ai/elements/forms';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

type FormFeedback = { readonly isPending: boolean; readonly error?: string | undefined; readonly onCancel: () => void };

type AgentInput = { readonly name: string; readonly model: string; readonly system: string };

export function StartAgentForm({
  isPending,
  error,
  onCancel,
  onStart,
}: FormFeedback & { readonly onStart: (input: AgentInput) => void }): ReactNode {
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [system, setSystem] = useState('');

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (name.trim().length > 0 && model.trim().length > 0 && !isPending) {
      onStart({ name: name.trim(), model: model.trim(), system });
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <Field.Root name="name" disabled={isPending}>
          <Field.Label>Agent name</Field.Label>
          <Input required value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </Field.Root>
        <Field.Root name="model" disabled={isPending}>
          <Field.Label>Model ID</Field.Label>
          <Input required value={model} onChange={(event) => setModel(event.currentTarget.value)} />
          <Field.Description>Use a model available on this installation.</Field.Description>
        </Field.Root>
        <Field.Root name="system" disabled={isPending}>
          <Field.Label>Instructions (optional)</Field.Label>
          <Textarea value={system} onChange={(event) => setSystem(event.currentTarget.value)} />
        </Field.Root>
        {error !== undefined && <Notice hasError>{error}</Notice>}
        <Row>
          <Button
            type="submit"
            variant="solid"
            disabled={name.trim().length === 0 || model.trim().length === 0}
            isPending={isPending}
            pendingLabel="Creating…"
          >
            Create agent
          </Button>
          <Button type="button" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </form>
  );
}

export function CreateEnvironmentForm({
  isPending,
  error,
  onCancel,
  onCreate,
}: FormFeedback & { readonly onCreate: (input: { readonly name: string }) => void }): ReactNode {
  const [name, setName] = useState('');

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (name.trim().length > 0 && !isPending) {
      onCreate({ name: name.trim() });
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <Field.Root name="name" disabled={isPending}>
          <Field.Label>Environment name</Field.Label>
          <Input required value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </Field.Root>
        {error !== undefined && <Notice hasError>{error}</Notice>}
        <Row>
          <Button
            type="submit"
            variant="solid"
            disabled={name.trim().length === 0}
            isPending={isPending}
            pendingLabel="Creating…"
          >
            Create environment
          </Button>
          <Button type="button" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </form>
  );
}
