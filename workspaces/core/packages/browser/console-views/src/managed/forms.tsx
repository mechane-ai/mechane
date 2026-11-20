import { Button, Row, Stack } from '@mechane-ai/elements';
import { PromptInput } from '@mechane-ai/elements/ai';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { Field, Input, SelectControl, Textarea } from '@mechane-ai/elements/forms';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

type Environment = { readonly id: string; readonly name: string };
type Thread = { readonly id: string; readonly name: string; readonly parentThreadId: string | null };
type StartInput = { readonly environmentId: string; readonly title: string; readonly firstMessage: string };

export function StartSessionForm({
  environments,
  isPending,
  error,
  onStart,
  onCancel,
  onCreateEnvironment,
}: {
  readonly environments: ReadonlyArray<Environment>;
  readonly isPending: boolean;
  readonly error?: string | undefined;
  readonly onStart: (input: StartInput) => void;
  readonly onCreateEnvironment?: (() => void) | undefined;
  readonly onCancel: () => void;
}): ReactNode {
  const [selectedEnvironment, selectEnvironment] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const selectedId = selectedEnvironment ?? (environments.length === 1 ? environments[0]?.id : null);
  const environment = environments.find((item) => item.id === selectedId);

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!isPending && environment !== undefined) {
      onStart({ environmentId: environment.id, title: title.trim(), firstMessage });
    }
  }

  if (environments.length === 0) {
    return (
      <EmptyState
        title="No environments available"
        action={
          <Row>
            {onCreateEnvironment !== undefined && (
              <Button variant="solid" onClick={onCreateEnvironment}>
                Create environment
              </Button>
            )}
            <Button onClick={onCancel}>Back to sessions</Button>
          </Row>
        }
      >
        A session needs an environment.
      </EmptyState>
    );
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <Field.Root name="environment" disabled={isPending}>
          <Field.Label>Environment</Field.Label>
          <SelectControl
            label="Environment"
            name="environment"
            value={environment?.id ?? null}
            items={environments.map((item) => ({ value: item.id, label: item.name }))}
            onValueChange={selectEnvironment}
            disabled={isPending}
            required
            placeholder="Choose an environment"
          />
        </Field.Root>
        <Field.Root name="title" disabled={isPending}>
          <Field.Label>Title (optional)</Field.Label>
          <Input value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        </Field.Root>
        <Field.Root name="firstMessage" disabled={isPending}>
          <Field.Label>First message (optional)</Field.Label>
          <Textarea isSensitive value={firstMessage} onValueChange={setFirstMessage} />
        </Field.Root>
        {error !== undefined && <Notice hasError>{error}</Notice>}
        <Row>
          <Button
            type="submit"
            variant="solid"
            isPending={isPending}
            disabled={environment === undefined}
            data-agent-confirm="Start this session?"
            pendingLabel="Starting…"
          >
            Start session
          </Button>
          <Button type="button" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </form>
  );
}

export function SessionThreadPicker({
  threads,
  threadId,
  onSelect,
}: {
  readonly threads: ReadonlyArray<Thread>;
  readonly threadId?: string | undefined;
  readonly onSelect: (threadId: string | undefined) => void;
}): ReactNode {
  if (threads.length === 0 && threadId === undefined) {
    return null;
  }

  const items = threads.map((thread) => ({
    value: thread.id,
    label: thread.name.length === 0 ? thread.id : thread.name,
  }));

  if (threadId !== undefined && !items.some((item) => item.value === threadId)) {
    items.push({ value: threadId, label: threadId });
  }

  return (
    <SelectControl
      label="Conversation thread"
      value={threadId ?? ''}
      items={[{ value: '', label: 'Session activity' }, ...items]}
      onValueChange={(id) => onSelect(id === '' || id === null ? undefined : id)}
    />
  );
}

export function SessionComposer({
  value,
  onChange,
  onSend,
  isPending,
  isDisabled,
  onInterrupt,
  isInterruptPending,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly isPending: boolean;
  readonly isDisabled?: boolean;
  readonly onInterrupt?: (() => void) | undefined;
  readonly isInterruptPending?: boolean | undefined;
  readonly error?: string | undefined;
}): ReactNode {
  return (
    <PromptInput
      isCompact
      name="message"
      label="Message this session"
      placeholder="Message this session…"
      value={value}
      onValueChange={onChange}
      onSubmit={onSend}
      enterBehavior="submit"
      isPending={isPending}
      isSubmitDisabled={value.trim().length === 0}
      disabled={isDisabled ?? false}
      error={error}
      controls={
        onInterrupt === undefined ? undefined : (
          <Button
            variant="ghost"
            type="button"
            data-agent-confirm="Interrupt this session?"
            onClick={onInterrupt}
            isPending={isInterruptPending ?? false}
            pendingLabel="Interrupting…"
          >
            Interrupt session
          </Button>
        )
      }
    />
  );
}
