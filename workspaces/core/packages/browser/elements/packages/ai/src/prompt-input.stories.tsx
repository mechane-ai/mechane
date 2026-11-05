import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, ChevronDown, Paperclip } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Row, Stack, Text } from '../../core/src/index.ts';
import { Meter } from '../../feedback/src/index.ts';
import { Combobox } from '../../forms/src/index.ts';
import { Popover } from '../../overlays/src/index.ts';
import { MessageAttachment } from './message.tsx';
import { PromptInput } from './prompt-input.tsx';

const meta = {
  title: 'AI/Prompt input',
  component: PromptInput,
  parameters: {
    docs: {
      description: {
        component:
          'PromptInput presents an application-owned draft in one framed composer. Its label stays accessible while the placeholder supplies the visible prompt. Text grows within a bounded input region. Optional controls, attachments and a named send or stop action remain inside the frame; feedback stays visible below it. The application owns submission, request identity and acknowledgement. Pending submission makes the draft read-only. Newline is the default Enter behavior; submit mode respects IME composition and Shift+Enter. Stop replaces Send and prevents hidden Enter submission.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const models = [
  { id: 'balanced', name: 'Balanced', description: 'General research and editing' },
  { id: 'fast', name: 'Fast', description: 'Short, focused questions' },
  { id: 'deliberate', name: 'Deliberate', description: 'Longer analysis with supplied evidence' },
];

function ComposerExample(): ReactNode {
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(models[0] ?? null);
  const [hasAttachment, setAttachment] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Stack>
      <Row>
        <Button onClick={() => setDraft('Summarize the evaluation results.')}>Summarize results</Button>
        <Button onClick={() => setDraft('Find the cases with missing measurements.')}>Find missing cases</Button>
      </Row>
      <PromptInput
        label="Message"
        value={draft}
        onValueChange={(value) => {
          setDraft(value);
          setError(undefined);
        }}
        onSubmit={() => setError('The request was rejected. Your draft is still here; retry when ready.')}
        maxLength={65_536}
        enterBehavior="submit"
        error={error}
        description="Enter sends. Shift+Enter adds a line. This example keeps the draft after a rejected submission."
        attachments={
          hasAttachment && (
            <MessageAttachment
              name="measurements.csv"
              description="Prepared attachment"
              actions={<Button onClick={() => setAttachment(false)}>Remove</Button>}
            />
          )
        }
        controls={
          <>
            <Combobox.Root
              items={models}
              value={model}
              onValueChange={setModel}
              itemToStringLabel={(item) => item.name}
              itemToStringValue={(item) => item.id}
              isItemEqualToValue={(item, selected) => item.id === selected.id}
            >
              <Combobox.InputGroup>
                <Combobox.Input aria-label="Model" placeholder="Choose model" />
                <Combobox.Trigger aria-label="Show models">
                  <ChevronDown size={16} />
                </Combobox.Trigger>
              </Combobox.InputGroup>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Empty>No matching models.</Combobox.Empty>
                    <Combobox.List>
                      {(item: (typeof models)[number]) => (
                        <Combobox.Item key={item.id} value={item}>
                          <Combobox.ItemIndicator>
                            <Check size={14} />
                          </Combobox.ItemIndicator>
                          {item.name}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Button type="button" onClick={() => setAttachment(true)} disabled={hasAttachment}>
              <Paperclip size={16} aria-hidden />
              Attach example
            </Button>
            <Popover.Root>
              <Popover.Trigger render={<Button type="button" />}>Context</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <Stack>
                      <Popover.Title>Context capacity</Popover.Title>
                      <Meter
                        label="Current conversation"
                        value={24_000}
                        max={128_000}
                        valueLabel="24,000 of 128,000 tokens"
                      />
                      <Text>Capacity and token counts are supplied by the application.</Text>
                    </Stack>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </>
        }
      />
    </Stack>
  );
}

function StoppableExample(): ReactNode {
  const [draft, setDraft] = useState('Keep this follow-up while the reply finishes.');
  const [isRunning, setRunning] = useState(true);

  return (
    <PromptInput
      label="Follow-up"
      value={draft}
      onValueChange={setDraft}
      onSubmit={() => setRunning(true)}
      enterBehavior="submit"
      onStop={isRunning ? () => setRunning(false) : undefined}
      description="While Stop is visible, Enter does not send a new message. Stopping keeps the draft."
    />
  );
}

function PendingExample(): ReactNode {
  const [draft, setDraft] = useState('Summarize this run.');

  return (
    <PromptInput
      label="Message"
      value={draft}
      onValueChange={setDraft}
      onSubmit={(event) => event.preventDefault()}
      pending
    />
  );
}

export const Composer: Story = { render: () => <ComposerExample /> };
export const StopAndDraft: Story = { render: () => <StoppableExample /> };
export const Pending: Story = { render: () => <PendingExample /> };

export const Compact: Story = { render: () => <CompactExample /> };

function CompactExample(): ReactNode {
  const [draft, setDraft] = useState('');

  return (
    <PromptInput
      label="Message assistant"
      placeholder="Message assistant…"
      value={draft}
      onValueChange={setDraft}
      onSubmit={(event) => event.preventDefault()}
      enterBehavior="submit"
      compact
    />
  );
}

export const UnknownContext: Story = {
  render: () => <Meter label="Context capacity" value={null} max={128_000} valueLabel="Usage is unavailable" />,
};

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <ComposerExample />,
};
