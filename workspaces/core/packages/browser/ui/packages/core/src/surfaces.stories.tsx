import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './actions.tsx';
import { Loading } from './loading.tsx';
import { Columns, Divider, EmptyState, Notice, Panel, Row, Stack } from './surfaces.tsx';
import { Muted, Subheading } from './text.tsx';

const meta = {
  title: 'Data/Surfaces and feedback',
  component: Panel,
  subcomponents: { Columns, Divider, EmptyState, Notice, Row, Stack, Loading },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Panel groups related content; Stack, Row, Columns, and Divider provide ordinary flow and separation. EmptyState explains an empty result and its next action. Notice announces progress or an error; Loading names missing initial content while preserving its shape. The application chooses the read state, retry handler, and permission-aware action. Keep existing content mounted during refreshes, and place a failed-refresh Notice beside it. Reserve Loading and full errors for an initial read with no usable result.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Columns>
      <Panel>
        <Stack compact>
          <Subheading>Summary</Subheading>
          <Muted>Related information stays together.</Muted>
          <Divider />
          <Row between>
            <Muted>Last saved just now</Muted>
            <Button>View details</Button>
          </Row>
        </Stack>
      </Panel>
      <Panel padded={false}>
        <EmptyState title="No items yet" action={<Button variant="solid">Create item</Button>}>
          Create the first item when you are ready.
        </EmptyState>
      </Panel>
    </Columns>
  ),
};

export const InitialLoading: Story = {
  render: () => (
    <Stack>
      <Panel padded={false}>
        <Loading label="Loading items" />
      </Panel>
      <Panel>
        <Loading label="Loading item details" shape="detail" />
      </Panel>
    </Stack>
  ),
};

export const InitialFailure: Story = {
  render: () => (
    <Notice error>
      Items could not be loaded. <Button>Retry</Button>
    </Notice>
  ),
};

export const RefreshFailure: Story = {
  render: () => (
    <Stack>
      <Notice error>
        Refresh failed. Showing the last saved result. <Button>Retry refresh</Button>
      </Notice>
      <Panel>
        <Stack compact>
          <Subheading>Release notes</Subheading>
          <Muted>The existing result remains available while a retry is possible.</Muted>
        </Stack>
      </Panel>
    </Stack>
  ),
};

export const UnavailableAction: Story = {
  render: () => (
    <EmptyState title="No shared items">
      Only an editor can create items in this collection. Ask an editor to add the first one.
    </EmptyState>
  ),
};

export const NarrowColumns: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };
