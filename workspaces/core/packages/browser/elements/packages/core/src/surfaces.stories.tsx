import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { EmptyState, Loading, Notice } from '../../feedback/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Button } from './actions.tsx';
import { Columns, Divider, Panel, Row, Stack, SurfaceLink } from './surfaces.tsx';
import { Muted, Subheading } from './text.tsx';

const styles = stylex.create({ linkContent: { padding: spacing.lg } });

const meta = {
  title: 'Feedback/Surfaces',
  component: Panel,
  subcomponents: { Columns, Divider, EmptyState, Notice, Row, Stack, Loading, SurfaceLink },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Panel groups related content; Stack, Row, Columns, and Divider provide ordinary flow and separation. SurfaceLink makes supplied content one native navigation target with shared hover, press, and inset keyboard focus. Put it inside an unpadded Panel when a border is needed; its child owns content layout and padding. Use TextLink for inline navigation and Button for actions. Keep other interactive controls outside SurfaceLink. EmptyState explains an empty result and its next action. Notice announces progress or a local error; Loading names missing initial content while preserving its shape. The application chooses the read state, retry handler, and permission-aware action. Keep existing content mounted during refreshes and report a failed refresh through one resource-owned toast with Retry. Reserve Loading and local failure content for an initial read with no usable result.',
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

export const LinkedPanel: Story = {
  render: () => (
    <Panel padded={false}>
      <SurfaceLink href="#release-notes">
        <div {...stylex.props(styles.linkContent)}>
          <Stack compact>
            <Subheading>Release notes and follow-up review materials</Subheading>
            <Muted>Open the saved notes and the references supplied by collaborators.</Muted>
          </Stack>
        </div>
      </SurfaceLink>
    </Panel>
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

export const UnavailableAction: Story = {
  render: () => (
    <EmptyState title="No shared items">
      Only an editor can create items in this collection. Ask an editor to add the first one.
    </EmptyState>
  ),
};

export const NarrowColumns: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };
