import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button, Panel, Row, Stack } from '../../core/src/index.ts';
import { EmptyState, Notice } from './feedback.tsx';

const meta = {
  title: 'Feedback/Read states',
  component: Notice,
  subcomponents: { EmptyState },
  parameters: {
    docs: {
      description: {
        component:
          'EmptyState describes a successful read with no records and an optional permitted next action. Notice names an initial failure and its local recovery. The application owns the read state, permissions, message, and retry operation. Keep field validation beside its field. For a failed refresh with usable content, retain the content and report once through a resource-owned toast with Retry; do not also show an error banner.',
      },
    },
  },
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyCollection: Story = {
  render: () => (
    <Panel padded={false}>
      <EmptyState title="No saved views" action={<Button>Create a saved view</Button>}>
        Save a useful set of filters to return to it later.
      </EmptyState>
    </Panel>
  ),
};

export const TitleOnly: Story = { render: () => <EmptyState title="Nothing to review" /> };

export const LongContent: Story = {
  render: () => (
    <Stack>
      <EmptyState
        title="No records match workspace_platform_observability_archive_20261105"
        action={<Button>Clear the saved workspace and archive filters</Button>}
      >
        Change the current filters to include records from another workspace or a longer date range.
      </EmptyState>
      <Notice error>
        The initial read for workspace_platform_observability_archive_20261105 failed. Try again when the connection is
        available.
      </Notice>
    </Stack>
  ),
};

function InitialFailureExample() {
  const [failed, setFailed] = useState(true);

  if (!failed) {
    return (
      <Stack>
        <Notice>The synthetic read completed.</Notice>
        <Button onClick={() => setFailed(true)}>Restore initial failure</Button>
      </Stack>
    );
  }

  return (
    <Notice error>
      <Stack compact>
        <span>The records could not be loaded. Try the read again.</span>
        <Row>
          <Button onClick={() => setFailed(false)}>Retry</Button>
        </Row>
      </Stack>
    </Notice>
  );
}

export const InitialFailure: Story = { render: () => <InitialFailureExample /> };
