import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { SkipLink } from '../../navigation/src/index.ts';
import { Button, IconButton, IconLink, TextButton, TextLink } from './actions.tsx';
import { CopyValue } from './copy-value.tsx';
import { Row, Stack } from './surfaces.tsx';
import { Muted } from './text.tsx';

const styles = stylex.create({ narrow: { width: 180, maxWidth: '100%' } });

const meta = {
  title: 'Controls/Actions',
  component: Button,
  subcomponents: { IconButton, IconLink, TextButton, TextLink, SkipLink, CopyValue },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Button performs an action; variant sets emphasis and tone sets destructive intent. Button, IconButton, IconLink, and TextButton default to standard density. Choose compact explicitly for a report action; 32px standard and 28px compact controls both use 44px coarse-pointer targets. Density preserves 13px labels, 20px line height, and 16px icons. Wrapped labels can grow either control. IconButton and IconLink require accessible labels. IconLink preserves anchor behavior and accepts render composition with a router link. TextButton fits an inline action, while TextLink is an anchor for navigation. SkipLink precedes navigation and moves keyboard focus to a main region with a stable ID and tabIndex={-1}; use TextLink for ordinary navigation. The application supplies handlers, destinations, permissions, and pending state. Use render to compose Base UI triggers; keep refs, events, classes, and styles intact. Tab through these examples to inspect keyboard focus. Pending actions prevent duplicate activation and keep their label space.',
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
    <Stack isCompact>
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

export const IconsAndNavigation: Story = {
  render: () => (
    <Row>
      <Button>
        <Plus size={16} aria-hidden />
        Add item
      </Button>
      <IconButton aria-label="Refresh items">
        <RefreshCw size={16} aria-hidden />
      </IconButton>
      <Button nativeButton={false} render={<a href="#example-source" />}>
        Open source
      </Button>
      <IconLink aria-label="Open source" href="#example-source">
        <ExternalLink size={16} aria-hidden />
      </IconLink>
    </Row>
  ),
};

export const Compact: Story = {
  render: () => (
    <Stack isCompact>
      <Row>
        <Button>OK</Button>
        <TextButton>OK</TextButton>
        <Button density="compact">OK</Button>
        <TextButton density="compact">OK</TextButton>
      </Row>
      <Row>
        <Button>Standard action</Button>
        <Button density="compact">Compact action</Button>
        <Button density="compact" variant="solid">
          Apply filter
        </Button>
        <Button density="compact" variant="ghost">
          Reset
        </Button>
        <Button density="compact" tone="danger">
          Remove filter
        </Button>
      </Row>
      <Row>
        <IconButton density="compact" aria-label="Refresh report">
          <RefreshCw size={16} aria-hidden />
        </IconButton>
        <IconLink density="compact" aria-label="Open report source" href="#example-source">
          <ExternalLink size={16} aria-hidden />
        </IconLink>
        <TextButton density="compact">Show details</TextButton>
        <Button density="compact" isPending pendingLabel="Refreshing report…">
          <RefreshCw size={16} aria-hidden />
          Refresh report
        </Button>
        <IconButton density="compact" isPending aria-label="Refresh report">
          <RefreshCw size={16} aria-hidden />
        </IconButton>
        <Button density="compact" disabled>
          Apply filter
        </Button>
      </Row>
      <div {...stylex.props(styles.narrow)}>
        <Button density="compact" pendingLabel="Refreshing workspace details and execution history…">
          <RefreshCw size={16} aria-hidden />
          Refresh workspace details and execution history
        </Button>
      </div>
    </Stack>
  ),
};

export const PendingAndDisabled: Story = {
  render: () => (
    <Stack isCompact>
      <Row>
        <Button pendingLabel="Refreshing items…">
          <RefreshCw size={16} aria-hidden />
          Refresh items
        </Button>
        <Button isPending pendingLabel="Refreshing items…">
          <RefreshCw size={16} aria-hidden />
          Refresh items
        </Button>
      </Row>
      <Row>
        <Button variant="solid" isPending pendingLabel="Saving changes…">
          Save changes
        </Button>
        <Button disabled>Save changes</Button>
        <IconButton isPending aria-label="Refresh items">
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
      <Stack isCompact>
        <Button variant="solid">
          <RefreshCw size={16} aria-hidden />
          Refresh workspace details and execution history
        </Button>
        <Button pendingLabel="Refreshing workspace details and execution history…">
          <RefreshCw size={16} aria-hidden />
          Refresh workspace details and execution history
        </Button>
        <Button isPending pendingLabel="Refreshing workspace details and execution history…">
          <RefreshCw size={16} aria-hidden />
          Refresh workspace details and execution history
        </Button>
        <Button disabled>
          <RefreshCw size={16} aria-hidden />
          Refresh workspace details and execution history
        </Button>
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
