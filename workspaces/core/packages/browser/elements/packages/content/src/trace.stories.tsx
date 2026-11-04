import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Text } from '../../core/src/index.ts';
import { Trace } from './trace.tsx';

const meta = {
  title: 'Content/Trace',
  component: Trace.Root,
  subcomponents: { Item: Trace.Item, Group: Trace.Group },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Trace shows supplied ordered steps and nested groups. It infers no duration, causality or execution state. The application supplies stable item IDs, exact status labels, ordering and detail content. Supply selected and onSelect together when selection affects the application. Details uses a local Collapsible. Use Waterfall for measured intervals and a plain list when no status evidence exists. Trace is presentation only; it never starts, retries or cancels work.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function RecordedSteps(): ReactNode {
  const [selected, setSelected] = useState('request');

  return (
    <Trace.Root label="Recorded request steps">
      <Trace.Item
        id="received"
        label="Request received"
        status="complete"
        statusLabel="Recorded at 09:00:00 UTC"
        selected={selected === 'received'}
        onSelect={setSelected}
      />
      <Trace.Item
        id="request"
        label="Model request"
        status="running"
        statusLabel="Awaiting settlement"
        description="Reservation evidence is available; inference timing is not."
        selected={selected === 'request'}
        onSelect={setSelected}
        detail={<Text>Request 001 · 2,048 tokens reserved</Text>}
      >
        <Trace.Group label="Related evidence">
          <Trace.Item id="substep" label="Input accepted" status="complete" statusLabel="Confirmed" />
        </Trace.Group>
      </Trace.Item>
      <Trace.Item id="pending" label="Publish result" status="pending" statusLabel="Not started" />
    </Trace.Root>
  );
}

export const RecordedActivity: Story = { render: () => <RecordedSteps /> };

export const DistinctOutcomes: Story = {
  render: () => (
    <Trace.Root label="Recorded outcomes">
      <Trace.Item
        id="refused"
        label="Request refused"
        status="failed"
        statusLabel="Refused before execution"
        description="The application supplies the refusal reason."
      />
      <Trace.Item id="skipped" label="Optional analysis" status="skipped" statusLabel="Not requested" />
      <Trace.Item
        id="unknown"
        label="Newer record format"
        status="unknown"
        statusLabel="Outcome unavailable"
        description="No success or duration is inferred."
      />
    </Trace.Root>
  ),
};
