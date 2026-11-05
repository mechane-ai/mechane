import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { Cell, Table } from '../../collections/src/index.ts';
import { Button, Columns, Muted, Panel, Row, Stack, Text } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { AsyncRegion, ContentReveal } from './async-region.tsx';
import { Loading } from './loading.tsx';
import { Meter, Progress } from './progress.tsx';
import { Skeleton, SkeletonText, Spinner } from './skeleton.tsx';

const meta = {
  title: 'Feedback/Loading and progress',
  component: Progress,
  subcomponents: { Meter, Skeleton, SkeletonText, Spinner, Loading, AsyncRegion, ContentReveal },
  parameters: {
    docs: {
      description: {
        component:
          'Progress describes task completion; Meter describes a bounded current measurement. Both require caller-formatted labels, an explicit maximum and a value; null is unavailable or indeterminate, never zero. Skeleton and SkeletonText are decorative geometry for a labelled loading region. Loading shares row and header measurements with tables. Spinner provides a steady busy glyph and accessible label without continuous motion. AsyncRegion owns initial pending presentation; ContentReveal supplies its short, reduced-motion-aware entrance. Keep usable content mounted while refreshing and place the refresh indicator beside it.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({
  sample: {
    minWidth: 0,
    padding: spacing.lg,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  surface: { backgroundColor: colors.surface },
  canvas: { backgroundColor: colors.canvas },
});

type PlaceholderSampleProps = { readonly label: string };

function PlaceholderSample({ label }: PlaceholderSampleProps) {
  return (
    <div role="status" aria-label={label}>
      <Row>
        <Skeleton shape="circle" width={32} height={32} />
        <Skeleton width={140} height={14} />
      </Row>
      <SkeletonText lines={3} />
      <Skeleton height={128} />
    </div>
  );
}

export const Measurements: Story = {
  render: () => (
    <Stack>
      <Progress label="Processed records" value={36} max={48} valueLabel="36 of 48 records" />
      <Progress label="Waiting for progress" value={null} max={48} valueLabel="Progress unavailable" />
      <Progress label="New task" value={0} max={48} valueLabel="0 of 48 records" />
      <Progress label="Completed task" value={48} max={48} valueLabel="48 of 48 records" />
      <Meter label="Context capacity" value={12_400} max={128_000} valueLabel="12,400 of 128,000 tokens" />
      <Meter label="Unreported capacity" value={null} max={128_000} valueLabel="Usage unavailable" />
    </Stack>
  ),
};

export const PlaceholderGeometry: Story = {
  render: () => (
    <Stack>
      <Columns>
        <div {...stylex.props(styles.sample, styles.surface)}>
          <Stack compact>
            <Text>Surface</Text>
            <PlaceholderSample label="Loading surface example" />
          </Stack>
        </div>
        <div {...stylex.props(styles.sample, styles.canvas)}>
          <Stack compact>
            <Text>Canvas</Text>
            <PlaceholderSample label="Loading canvas example" />
          </Stack>
        </div>
      </Columns>
      <Muted>
        Placeholders remain visible on either application surface. They reserve layout without implying records or
        permissions.
      </Muted>
    </Stack>
  ),
};

export const RetainedContent: Story = {
  render: () => (
    <Panel>
      <Stack>
        <Row>
          <Text>Last successful result remains visible</Text>
          <Spinner label="Refreshing results" />
        </Row>
        <Text>48 records in the selected scope</Text>
        <Spinner label="Refreshing results" showLabel />
      </Stack>
    </Panel>
  ),
};

export const InitialRows: Story = { render: () => <Loading label="Loading records" /> };
export const InitialDetail: Story = { render: () => <Loading label="Loading detail" shape="detail" /> };

export const LongLabels: Story = {
  render: () => (
    <Stack>
      <Progress
        label="Preparing the platform-observability-archive-2026-11-05 export"
        value={36}
        max={48}
        valueLabel="36 of 48 records prepared for the selected workspace"
      />
      <Meter
        label="Remaining capacity for the shared workspace collection"
        value={null}
        max={128_000}
        valueLabel="Capacity has not been reported by the current provider"
      />
      <Spinner label="Refreshing workspace_platform_observability_archive_20261105" showLabel />
    </Stack>
  ),
};

function RowTransitionExample() {
  const [pending, setPending] = useState(true);

  return (
    <Stack>
      <Button onClick={() => setPending(!pending)}>{pending ? 'Complete read' : 'Show initial loading'}</Button>
      <Panel padded={false}>
        <AsyncRegion pending={pending} label="Loading records" placeholder={<Loading label="Loading records" />}>
          <Table
            label="Synthetic records"
            headers={[
              { label: 'Name', width: 50 },
              { label: 'State', width: 25 },
              { label: 'Owner', width: 25 },
            ]}
          >
            <tr>
              <Cell>Getting started</Cell>
              <Cell>Ready</Cell>
              <Cell>Design</Cell>
            </tr>
            <tr>
              <Cell>Review queues</Cell>
              <Cell>Ready</Cell>
              <Cell>Support</Cell>
            </tr>
            <tr>
              <Cell>Release notes</Cell>
              <Cell>Ready</Cell>
              <Cell>Platform</Cell>
            </tr>
          </Table>
        </AsyncRegion>
      </Panel>
      <Muted>The initial placeholder and loaded table share header height, row height, and column insets.</Muted>
    </Stack>
  );
}

export const RowTransition: Story = { render: () => <RowTransitionExample /> };

function PendingExample() {
  const [pending, setPending] = useState(true);

  return (
    <Stack>
      <Button onClick={() => setPending(!pending)}>{pending ? 'Complete read' : 'Start another read'}</Button>
      <AsyncRegion pending={pending} delayMs={1200} label="Loading example" placeholder={<SkeletonText lines={3} />}>
        <Panel>
          <Text>The completed result is available immediately.</Text>
        </Panel>
      </AsyncRegion>
      <Muted>The application supplies the pending state and its visibility delay. There is no minimum wait.</Muted>
    </Stack>
  );
}

export const DelayedRegion: Story = { render: () => <PendingExample /> };
