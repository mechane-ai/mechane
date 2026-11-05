import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { EmptyState, Notice } from '../../feedback/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Button } from './actions.tsx';
import { Columns, Divider, Panel, Row, Stack, SurfaceLink } from './surfaces.tsx';
import { Muted, Subheading } from './text.tsx';

const styles = stylex.create({ linkContent: { padding: spacing.lg } });

const meta = {
  title: 'Feedback/Surfaces',
  component: Panel,
  subcomponents: { Columns, Divider, EmptyState, Notice, Row, Stack, SurfaceLink },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Panel groups related content; Stack, Row, Columns, and Divider provide ordinary flow and separation. SurfaceLink makes supplied content one native navigation target with shared hover, press, and inset keyboard focus. Put it inside an unpadded Panel when a border is needed; its child owns content layout and padding. Use TextLink for inline navigation and Button for actions. Keep other interactive controls outside SurfaceLink. EmptyState explains an empty result and its next action. Notice announces progress or a local error. AsyncRegion owns delayed loading presentation with a destination-specific placeholder. The application chooses the read state, retry handler, and permission-aware action. Keep existing content mounted during refreshes and report a failed refresh alongside it with Retry. Reserve the pending and initial-failure views for reads with no usable result.',
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
        <Stack isCompact>
          <Subheading>Summary</Subheading>
          <Muted>Related information stays together.</Muted>
          <Divider />
          <Row shouldSpaceBetween>
            <Muted>Last saved just now</Muted>
            <Button>View details</Button>
          </Row>
        </Stack>
      </Panel>
      <Panel isPadded={false}>
        <EmptyState title="No items yet" action={<Button variant="solid">Create item</Button>}>
          Create the first item when you are ready.
        </EmptyState>
      </Panel>
    </Columns>
  ),
};

export const LinkedPanel: Story = {
  render: () => (
    <Panel isPadded={false}>
      <SurfaceLink href="#release-notes">
        <div {...stylex.props(styles.linkContent)}>
          <Stack isCompact>
            <Subheading>Release notes and follow-up review materials</Subheading>
            <Muted>Open the saved notes and the references supplied by collaborators.</Muted>
          </Stack>
        </div>
      </SurfaceLink>
    </Panel>
  ),
};

export const InitialFailure: Story = {
  render: () => (
    <Notice hasError>
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
