import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { DataTable, DataTablePlaceholder } from '../../collections/src/index.ts';
import type { DataTableColumn } from '../../collections/src/index.ts';
import { Avatar, Button, Columns, IconButton, Muted, Panel, Row, Stack, Text } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { AsyncRegion, ContentReveal, LoadingScope } from './async-region.tsx';
import type { AsyncRegionState } from './async-region.tsx';
import { ButtonPlaceholder, FieldPlaceholder } from './control-placeholders.tsx';
import { Meter, Progress } from './progress.tsx';
import { Skeleton, SkeletonText, Spinner } from './skeleton.tsx';

const meta = {
  title: 'Feedback/Loading and progress',
  component: Progress,
  subcomponents: {
    Meter,
    Skeleton,
    SkeletonText,
    Spinner,
    ButtonPlaceholder,
    FieldPlaceholder,
    AsyncRegion,
    ContentReveal,
    LoadingScope,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Progress describes task completion; Meter describes a bounded current measurement. Both require caller-formatted labels, an explicit maximum and a value; null is unavailable or indeterminate, never zero. Skeleton and SkeletonText are decorative geometry for a labelled loading region. ButtonPlaceholder and single-line FieldPlaceholder use the loaded control’s explicit density: standard by default, compact for a local report. Both densities grow to 44px on coarse pointers. Multiline fields retain their row sizing. Supply placeholder widths for the expected content, and announce loading at the owning region. Spinner provides a steady busy glyph and accessible label without continuous motion. AsyncRegion reserves its placeholder immediately, waits two seconds before showing it, and reveals ready content in 80ms. Its image presentation shows the placeholder immediately and fades a newly ready image in over 200ms. Ready-at-mount and failed states are immediate. LoadingScope shares one clock across a page and resets it by identity without remounting children. Pass destination-specific decorative geometry, such as DataTablePlaceholder using the same columns as the real table. Keep ready content mounted while refreshing; the data owner supplies refresh notices alongside it. The loading announcement is separate from the busy region so assistive technology can announce it once.',
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
  image: { display: 'flex', width: 40, height: 40 },
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
          <Stack isCompact>
            <Text>Surface</Text>
            <PlaceholderSample label="Loading surface example" />
          </Stack>
        </div>
        <div {...stylex.props(styles.sample, styles.canvas)}>
          <Stack isCompact>
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

export const ControlDensities: Story = {
  render: () => (
    <Stack>
      <Row>
        <Button>OK</Button>
        <ButtonPlaceholder width="1ch" />
        <Button pendingLabel="Refreshing report…">Refresh report</Button>
        <Button isPending pendingLabel="Refreshing report…">
          Refresh report
        </Button>
        <ButtonPlaceholder width="12ch" />
        <IconButton aria-label="Refresh report">
          <RefreshCw size={16} aria-hidden />
        </IconButton>
        <ButtonPlaceholder isIconOnly />
      </Row>
      <Row>
        <Button density="compact">OK</Button>
        <ButtonPlaceholder density="compact" width="1ch" />
        <Button density="compact" pendingLabel="Refreshing report…">
          Refresh report
        </Button>
        <Button density="compact" isPending pendingLabel="Refreshing report…">
          Refresh report
        </Button>
        <ButtonPlaceholder density="compact" width="12ch" />
        <IconButton density="compact" aria-label="Refresh report">
          <RefreshCw size={16} aria-hidden />
        </IconButton>
        <ButtonPlaceholder density="compact" isIconOnly />
      </Row>
      <Columns>
        <FieldPlaceholder label="Standard field" hint="Ordinary form control" />
        <FieldPlaceholder density="compact" label="Compact field" hint="Local report control" />
      </Columns>
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

interface RecordExample {
  readonly name: string;
  readonly state: string;
  readonly owner: string;
}

const records: ReadonlyArray<RecordExample> = [
  { name: 'Getting started', state: 'Ready', owner: 'Design' },
  { name: 'Review queues', state: 'Ready', owner: 'Support' },
  { name: 'Release notes', state: 'Ready', owner: 'Platform' },
];

const recordColumns = [
  { id: 'name', label: 'Name', role: 'primary', cell: (record) => record.name },
  { id: 'state', label: 'State', role: 'status', cell: (record) => record.state },
  { id: 'owner', label: 'Owner', role: 'text', cell: (record) => record.owner },
] satisfies ReadonlyArray<DataTableColumn<RecordExample>>;

function ReadExample({ initialState = 'pending' }: { readonly initialState?: AsyncRegionState }) {
  const [state, setState] = useState(initialState);
  const [attempt, setAttempt] = useState(0);
  const region = { label: 'Loading records', placeholder: <DataTablePlaceholder columns={recordColumns} /> };

  return (
    <Stack>
      <Row>
        <Button
          onClick={() => {
            setAttempt(attempt + 1);
            setState('pending');
          }}
        >
          Start read
        </Button>
        <Button onClick={() => setState('ready')}>Complete read</Button>
        <Button onClick={() => setState('failed')}>Fail read</Button>
      </Row>
      <Panel isPadded={false}>
        <LoadingScope identity={attempt}>
          {state === 'pending' ? (
            <AsyncRegion state="pending" {...region} />
          ) : state === 'failed' ? (
            <AsyncRegion state="failed" {...region}>
              <Text>The read failed. Start another read to retry.</Text>
            </AsyncRegion>
          ) : (
            <AsyncRegion state="ready" {...region}>
              <DataTable
                caption="Synthetic records"
                hideCaption
                rows={records}
                columns={recordColumns}
                getRowId={(record) => record.name}
                empty="No records"
              />
            </AsyncRegion>
          )}
        </LoadingScope>
      </Panel>
      <Muted>
        The placeholder shares the table's column definitions. Complete the read before two seconds to skip loading
        visuals; after two seconds the same reserved geometry becomes visible. Completion never waits for a minimum
        loading duration. A failure appears immediately.
      </Muted>
    </Stack>
  );
}

export const DelayedRegion: Story = { render: () => <ReadExample /> };
export const CachedRegion: Story = { render: () => <ReadExample initialState="ready" /> };
export const FailedRegion: Story = { render: () => <ReadExample initialState="failed" /> };

const image = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#647b96"/><circle cx="20" cy="15" r="8" fill="#e6edf4"/><circle cx="20" cy="39" r="15" fill="#e6edf4"/></svg>',
)}`;

function ImageExample() {
  const [state, setState] = useState<AsyncRegionState>('pending');
  const [visit, setVisit] = useState(0);
  const region = { label: 'Loading image', placeholder: <Skeleton width={40} height={40} /> };

  return (
    <Stack>
      <Row>
        <Button onClick={() => setState('pending')}>Start read</Button>
        <Button onClick={() => setState('ready')}>Complete read</Button>
        <Button onClick={() => setState('failed')}>Fail read</Button>
        <Button
          onClick={() => {
            setState('ready');
            setVisit((current) => current + 1);
          }}
        >
          Reopen cached image
        </Button>
      </Row>
      <div key={visit} {...stylex.props(styles.image)}>
        {state === 'pending' ? (
          <AsyncRegion {...region} presentation="image" state="pending" />
        ) : (
          <AsyncRegion {...region} presentation="image" state={state}>
            {state === 'ready' ? (
              <Avatar label="Example person" fallback="EP" src={image} size="lg" />
            ) : (
              <Avatar label="Example person" fallback="EP" size="lg" />
            )}
          </AsyncRegion>
        )}
      </div>
    </Stack>
  );
}

export const ImageRegion: Story = { render: () => <ImageExample /> };
