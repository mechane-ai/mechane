import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { SkipLink } from '../../navigation/src/index.ts';
import { Button, IconButton, IconLink, TextButton, TextLink } from './actions.tsx';
import { CopyValue } from './copy-value.tsx';
import { Row, Stack } from './surfaces.tsx';
import { Muted } from './text.tsx';

const styles = stylex.create({ narrow: { width: 240, maxWidth: '100%' } });

const meta = {
  title: 'Controls/Actions',
  component: Button,
  subcomponents: { IconButton, IconLink, TextButton, TextLink, SkipLink, CopyValue },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Button performs an action; variant sets emphasis and tone sets destructive intent. IconButton and IconLink require accessible labels. IconLink preserves anchor behavior and accepts render composition with a router link. TextButton fits an inline action, while TextLink is an anchor for navigation. SkipLink precedes navigation and moves keyboard focus to a main region with a stable ID and tabIndex={-1}; use TextLink for ordinary navigation. The application supplies handlers, destinations, permissions, and pending state. Use render to compose Base UI triggers; keep refs, events, classes, and styles intact. Tab through these examples to inspect keyboard focus. Pending actions prevent duplicate activation and keep their label space.',
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recommended: Story = {
  render: () => (
    <Row>
      <Button variant="solid">Save changes</Button>
      <Button>Cancel</Button>
    </Row>
  ),
};

export const EmphasisAndIntent: Story = {
  render: () => (
    <Stack compact>
      <Row>
        <Button variant="solid">Solid</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </Row>
      <Row>
        <Button variant="solid" tone="danger">
          Archive item
        </Button>
        <Button variant="outline" tone="danger">
          Archive item
        </Button>
        <Button variant="ghost" tone="danger">
          Archive item
        </Button>
      </Row>
    </Stack>
  ),
};

export const SizesAndIcons: Story = {
  render: () => (
    <Row>
      <Button size="sm">
        <Plus size={16} aria-hidden />
        Add item
      </Button>
      <Button size="md">
        <Plus size={16} aria-hidden />
        Add item
      </Button>
      <IconButton aria-label="Refresh items">
        <RefreshCw size={16} aria-hidden />
      </IconButton>
      <IconButton size="md" aria-label="Refresh items">
        <RefreshCw size={16} aria-hidden />
      </IconButton>
      <IconLink aria-label="Open source" href="#example-source">
        <ExternalLink size={16} aria-hidden />
      </IconLink>
    </Row>
  ),
};

export const PendingAndDisabled: Story = {
  render: () => (
    <Stack compact>
      <Row>
        <Button variant="solid" pending pendingLabel="Saving changes…">
          Save changes
        </Button>
        <Button disabled>Save changes</Button>
        <IconButton pending aria-label="Refresh items">
          <RefreshCw size={16} aria-hidden />
        </IconButton>
      </Row>
      <Muted>Pending actions keep focus and label space. Disabled actions remain named.</Muted>
    </Stack>
  ),
};

export const InlineActionsAndLinks: Story = {
  render: () => (
    <Row>
      <TextButton>Show details</TextButton>
      <TextLink href="#example-details">Open details</TextLink>
    </Row>
  ),
};

export const KeyboardNavigation: Story = {
  render: () => (
    <Stack>
      <SkipLink href="#example-main">Skip to content</SkipLink>
      <Muted>Press Tab to reveal the skip link, then Enter to move to the content.</Muted>
      <main id="example-main" tabIndex={-1}>
        <Button>First content action</Button>
      </main>
    </Stack>
  ),
};

export const LongLabels: Story = {
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <Stack compact>
        <Button variant="solid">Save the reviewed changes and notify collaborators</Button>
        <Button pending pendingLabel="Saving the reviewed changes and notifying collaborators…">
          Save the reviewed changes and notify collaborators
        </Button>
        <Button disabled>Save the reviewed changes and notify collaborators</Button>
      </Stack>
    </div>
  ),
};

export const StableCopyFeedback: Story = {
  render: () => (
    <Row>
      <CopyValue label="record reference" value="record-2026-11-05-0123456789abcdef" />
      <TextLink href="#record">Open record</TextLink>
    </Row>
  ),
};
