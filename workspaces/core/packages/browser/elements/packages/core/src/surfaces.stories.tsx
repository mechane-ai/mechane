import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { EmptyState, Notice } from '../../feedback/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Button } from './actions.tsx';
import { SectionHeading } from './section-heading.tsx';
import { Columns, Divider, Panel, Row, Stack, SurfaceLink } from './surfaces.tsx';
import { Muted, Subheading } from './text.tsx';

const styles = stylex.create({ linkContent: { padding: spacing.lg } });

const meta = {
  title: 'Feedback/Surfaces',
  component: Panel,
  subcomponents: { Columns, Divider, EmptyState, Notice, Row, Stack, SurfaceLink, SectionHeading },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Use Stack for vertically related sections and Row for aligned controls. SectionHeading identifies a section with optional metadata and actions. Use Subheading inside an existing section. Columns supports views that need simultaneous comparison and remain readable at their containing widths. Panel bounds an independent unit such as a conflict decision or navigable item. A chart report owns its frame. SurfaceLink makes supplied content one native navigation target with shared hover, press, and inset keyboard focus. Put it inside an unpadded Panel when the item needs a boundary. Its child owns content layout and padding. Use TextLink for inline navigation and Button for actions. Keep other interactive controls outside SurfaceLink. EmptyState explains an empty result and its next action. Notice announces progress or a local error. AsyncRegion owns delayed loading with a destination-specific placeholder. The application chooses read state, retry behavior and permission-aware actions. Keep existing content mounted during refreshes.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Stack>
      <SectionHeading title="Release checklist" meta="Draft" actions={<Button>View details</Button>} />
      <Stack isCompact>
        <Subheading>Summary</Subheading>
        <Muted>Last saved just now</Muted>
      </Stack>
      <Divider />
      <EmptyState title="No attachments" action={<Button variant="solid">Add attachment</Button>}>
        Attach supporting files when needed.
      </EmptyState>
    </Stack>
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

export const NarrowSections: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };
