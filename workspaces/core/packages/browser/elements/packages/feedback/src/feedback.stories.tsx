import type { Meta, StoryObj } from '@storybook/react-vite';
import { Muted, Panel, Row, Stack, Text } from '../../core/src/index.ts';
import { Loading } from './loading.tsx';
import { Meter, Progress } from './progress.tsx';
import { Skeleton, SkeletonText, Spinner } from './skeleton.tsx';

const meta = {
  title: 'Feedback/Loading and progress',
  component: Progress,
  subcomponents: { Meter, Skeleton, SkeletonText, Spinner, Loading },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Progress describes task completion; Meter describes a bounded current measurement. Both require caller-formatted labels, an explicit maximum and a value; null is unavailable or indeterminate, never zero. Skeleton and SkeletonText are decorative geometry for a labelled loading region. Loading supplies that region for existing rows and details. Spinner provides a steady busy glyph and accessible label without continuous motion. Keep usable content mounted while refreshing and place the refresh indicator beside it.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Measurements: Story = {
  render: () => (
    <Stack>
      <Progress label="Processed records" value={36} max={48} valueLabel="36 of 48 records" />
      <Progress label="Waiting for progress" value={null} max={48} valueLabel="Progress unavailable" />
      <Progress label="New task" value={0} max={48} valueLabel="0 of 48 records" />
      <Meter label="Context capacity" value={12_400} max={128_000} valueLabel="12,400 of 128,000 tokens" />
      <Meter label="Unreported capacity" value={null} max={128_000} valueLabel="Usage unavailable" />
    </Stack>
  ),
};

export const PlaceholderGeometry: Story = {
  render: () => (
    <Panel>
      <Stack>
        <div role="status" aria-label="Loading example message">
          <Row>
            <Skeleton shape="circle" width={32} height={32} />
            <Skeleton width={140} height={14} />
          </Row>
          <SkeletonText />
          <Skeleton height={128} />
        </div>
        <Muted>Placeholders reserve the content’s layout. They do not imply records or permissions.</Muted>
      </Stack>
    </Panel>
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
