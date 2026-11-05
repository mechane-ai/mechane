import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Panel, Row, Stack, Text } from '../../../core/src/index.ts';
import { AsyncRegion } from '../../../feedback/src/index.ts';
import type { BreakdownItem } from '../categorical-values.tsx';
import { ChartFrame, ChartLegend } from '../chart-frame.tsx';
import { BarChart, BarChartPlaceholder } from './bar-chart.tsx';
import type { BarSeries } from './bar-chart.tsx';
import { BreakdownBar } from './breakdown-bar.tsx';
import { Sparkline } from './sparkline.tsx';
import type { TimeSeries } from './time-series-data.ts';
import { AreaChart, LineChart, SmallMultiples } from './time-series.tsx';

const meta = {
  title: 'Charts/Cartesian',
  component: LineChart,
  subcomponents: {
    AreaChart,
    Sparkline,
    SmallMultiples,
    BarChart,
    BarChartPlaceholder,
    BreakdownBar,
    ChartFrame,
    ChartLegend,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Application-prepared observations and categories. Formatters own units and time zones. Missing observations remain gaps. LineChart, AreaChart, and SmallMultiples support pointer, touch, and arrow-key value inspection; Escape dismisses it. These full charts retain exact records under View data and preserve inspection when equivalent values replace their input arrays. Choose LineChart for trends, AreaChart for magnitude or explicit stacking, Sparkline for a passive inline trend with an application-written summary and explicit value domain, and SmallMultiples for aligned panels. BarChart compares categories with pointer, touch, and arrow-key inspection; optional axisLabel keeps ticks concise while full labels remain inspectable. BarChartPlaceholder shares its frame, legend, plot height, idle inspection, and closed disclosure geometry. Pass the known title, description, series labels, and matching height through AsyncRegion; the placeholder is inert and supplies no data or loading announcement. Unknown titles use the explicit label Loading chart. BreakdownBar shows nonnegative parts of a whole. ChartFrame supplies a title, description, actions and footer for a custom plot. ChartLegend labels supplied tones. Full charts already own their frame and legend; do not wrap them in a second frame.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const times = [0, 30, 90, 120, 180, 240, 360];

const baseline: TimeSeries = {
  id: 'baseline',
  label: 'Baseline',
  tone: 'series1',
  points: times.map((timestamp, index) => ({ timestamp, value: [12, 16, null, 14, 19, 22, 21][index] ?? null })),
};

const candidate: TimeSeries = {
  id: 'candidate',
  label: 'Candidate',
  tone: 'series3',
  points: times.map((timestamp, index) => ({ timestamp, value: [9, 13, 15, 12, 16, 18, 16][index] ?? null })),
};

function formatTime(value: number): string {
  return `${value} s`;
}

function formatLatency(value: number): string {
  return `${value} ms`;
}

function formatTokens(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} tokens`;
}

const allocation: ReadonlyArray<BreakdownItem> = [
  { id: 'input', label: 'Input', value: 840, tone: 'series1' },
  { id: 'output', label: 'Output', value: 260, tone: 'series2' },
  { id: 'cache-read', label: 'Cache read', value: 500, tone: 'series3' },
  { id: 'cache-write', label: 'Cache write', value: 0, tone: 'series4' },
];

export const Observations: Story = {
  render: () => (
    <Panel>
      <LineChart
        title="Request latency"
        description="Synthetic observations. The baseline has a missing sample at 90 seconds; elapsed-time spacing remains visible."
        series={[baseline, candidate]}
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatLatency}
        markers={[
          { id: 'partial', kind: 'time', timestamp: 360, label: 'Partial period' },
          {
            id: 'checkpoint',
            kind: 'point',
            seriesId: 'candidate',
            timestamp: 120,
            value: 12,
            label: 'Candidate checkpoint',
          },
        ]}
      />
    </Panel>
  ),
};

function ReplaceObservations(): ReactNode {
  const [series, setSeries] = useState<ReadonlyArray<TimeSeries>>([baseline, candidate]);

  const actions = (
    <Row>
      <Button
        variant="outline"
        onClick={() =>
          setSeries(series.map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })) })))
        }
      >
        Equivalent records
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          setSeries(
            series.map((item) => ({
              ...item,
              points: item.points.map((point) => ({ ...point, value: point.value === null ? null : point.value + 1 })),
            })),
          )
        }
      >
        Change values
      </Button>
    </Row>
  );

  return (
    <Stack>
      <Text>
        Inspect an observation, then replace the records. Equivalent values keep the inspection; changed values close
        it.
      </Text>
      <LineChart
        title="Inspection ownership"
        series={series}
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatLatency}
        actions={actions}
      />
    </Stack>
  );
}

export const RefreshSemantics: Story = { render: () => <ReplaceObservations /> };

export const AreasAndSparklines: Story = {
  render: () => (
    <Stack>
      <AreaChart
        title="Recorded tokens"
        description="Each area begins at zero. Values are supplied observations, not inferred samples."
        series={[candidate]}
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatTokens}
      />
      <AreaChart
        title="Additive token counts"
        series={[
          candidate,
          {
            ...candidate,
            id: 'output',
            label: 'Output',
            tone: 'series2',
            points: candidate.points.map((point) => ({ ...point, value: point.value === null ? 0 : point.value / 2 })),
          },
        ]}
        isStacked
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatTokens}
      />
      <Row>
        <Text>Candidate latency · 16 ms</Text>
        <Sparkline
          title="Candidate latency trend"
          summary="Seven supplied observations over six minutes range from 9 to 18 milliseconds, ending at 16 milliseconds."
          unit="milliseconds"
          series={candidate}
          timestampUnit="seconds"
          valueDomain={[0, 24]}
        />
      </Row>
    </Stack>
  ),
};

export const AlignedMetrics: Story = {
  render: () => (
    <SmallMultiples
      charts={[
        { id: 'request', title: 'Request latency', series: [baseline], formatValue: formatLatency },
        { id: 'processing', title: 'Processing latency', series: [candidate], formatValue: formatLatency },
      ]}
      timestampUnit="seconds"
      formatTimestamp={formatTime}
      height={128}
    />
  ),
};

export const CategoricalSeries: Story = {
  render: () => (
    <Stack>
      <BarChart
        title="Tokens by operation"
        categories={[
          { id: 'assemble', label: 'Assemble' },
          { id: 'review', label: 'Review' },
          { id: 'publish', label: 'Publish' },
        ]}
        series={[
          { id: 'input', label: 'Input', tone: 'series1', values: [40, 70, 20] },
          { id: 'output', label: 'Output', tone: 'series2', values: [25, null, 0] },
        ]}
        domain={[0, 100]}
        formatValue={formatTokens}
      />
      <BarChart
        title="Additive tokens by operation"
        mode="stacked"
        categories={[
          { id: 'assemble', label: 'Assemble' },
          { id: 'review', label: 'Review' },
        ]}
        series={[
          { id: 'input', label: 'Input', tone: 'series1', values: [40, 70] },
          { id: 'output', label: 'Output', tone: 'series2', values: [25, 10] },
        ]}
        domain={[0, 100]}
        formatValue={formatTokens}
      />
    </Stack>
  ),
};

export const MissingSingleAndEmpty: Story = {
  render: () => (
    <Stack>
      <LineChart
        title="One observation"
        series={[{ id: 'single', label: 'Recorded latency', points: [{ timestamp: 30, value: 0 }] }]}
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatLatency}
      />
      <LineChart
        title="No observations"
        series={[]}
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatLatency}
      />
      <BreakdownBar
        title="Unavailable usage"
        items={[
          { id: 'input', label: 'Input', value: null },
          { id: 'output', label: 'Output', value: 0 },
        ]}
        total={0}
        formatValue={formatTokens}
      />
    </Stack>
  ),
};

export const InvalidEvidence: Story = {
  render: () => (
    <Stack>
      <LineChart
        title="Unsorted timestamps"
        series={[
          {
            id: 'invalid',
            label: 'Latency',
            points: [
              { timestamp: 30, value: 1 },
              { timestamp: 0, value: 2 },
            ],
          },
        ]}
        timestampUnit="seconds"
        formatTimestamp={formatTime}
        formatValue={formatLatency}
      />
      <BreakdownBar title="Inconsistent total" items={allocation} total={1000} formatValue={formatTokens} />
    </Stack>
  ),
};

function NarrowInspection(): ReactNode {
  const [selectedId, onSelect] = useState<string>('review');

  return (
    <Stack>
      <LineChart
        title="Latency across the complete validation and review sequence"
        description="Synthetic observations with full timestamps and long series labels."
        series={[
          { ...baseline, label: 'Baseline across the complete validation sequence' },
          { ...candidate, label: 'Candidate across the complete validation sequence' },
        ]}
        timestampUnit="seconds"
        formatTimestamp={(value) =>
          `2026-11-05 09:${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')} UTC`
        }
        formatValue={formatLatency}
      />
      <BarChart
        title="Recorded tokens by operation"
        categories={[
          { id: 'assemble', label: 'Assemble all source references for the review', axisLabel: 'Assemble' },
          { id: 'review', label: 'Review the complete collection of supplied references', axisLabel: 'Review' },
          { id: 'publish', label: 'Publish the accepted reference collection', axisLabel: 'Publish' },
        ]}
        series={[
          { id: 'input', label: 'Recorded input tokens', values: [40, 70, 20] },
          { id: 'output', label: 'Recorded output tokens', values: [25, null, 0] },
        ]}
        domain={[0, 100]}
        formatValue={formatTokens}
        selection={{ selectedId, onSelect }}
      />
    </Stack>
  );
}

export const NarrowLongLabels: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <NarrowInspection />,
};

export const PassiveTrendStates: Story = {
  render: () => (
    <Stack>
      <Row>
        <Text>Missing sample</Text>
        <Sparkline
          title="Baseline latency"
          summary="The sample at 90 seconds is missing."
          unit="milliseconds"
          timestampUnit="seconds"
          series={baseline}
          valueDomain={[0, 24]}
        />
      </Row>
      <Row>
        <Text>One observation</Text>
        <Sparkline
          title="Single latency"
          summary="One recorded value of zero milliseconds at 30 seconds."
          unit="milliseconds"
          timestampUnit="seconds"
          series={{ id: 'single', label: 'Latency', points: [{ timestamp: 30, value: 0 }] }}
          valueDomain={[0, 24]}
        />
      </Row>
      <Row>
        <Text>No observations</Text>
        <Sparkline
          title="Unavailable latency"
          summary="No latency observations were supplied."
          unit="milliseconds"
          timestampUnit="seconds"
          series={{ id: 'empty', label: 'Latency', points: [] }}
          valueDomain={[0, 24]}
        />
      </Row>
      <Row>
        <Text>Invalid domain</Text>
        <Sparkline
          title="Invalid latency"
          summary="The supplied values exceed the displayed domain."
          unit="milliseconds"
          timestampUnit="seconds"
          series={candidate}
          valueDomain={[0, 8]}
        />
      </Row>
    </Stack>
  ),
};

const loadingSeries: ReadonlyArray<BarSeries> = [
  { id: 'input', label: 'Recorded input tokens', tone: 'series1', values: [40, 70, 20] },
  { id: 'output', label: 'Recorded output tokens', tone: 'series2', values: [25, 10, 0] },
];

function BarLoadingGeometry(): ReactNode {
  const [isPending, setPending] = useState(true);
  const title = 'Recorded tokens by operation';
  const description = 'Synthetic observations for the selected period.';
  const knownSeries = loadingSeries.map(({ id, label, tone }) => ({ id, label, tone }));

  return (
    <Stack>
      <Button variant="outline" onClick={() => setPending(!isPending)}>
        {isPending ? 'Show recorded values' : 'Show loading state'}
      </Button>
      <Panel>
        {isPending ? (
          <AsyncRegion
            state="pending"
            label="Loading recorded token values"
            placeholder={
              <BarChartPlaceholder title={title} description={description} series={knownSeries} height={180} />
            }
          />
        ) : (
          <AsyncRegion
            state="ready"
            label="Loading recorded token values"
            placeholder={
              <BarChartPlaceholder title={title} description={description} series={knownSeries} height={180} />
            }
          >
            <BarChart
              title={title}
              description={description}
              categories={[
                { id: 'assemble', label: 'Assemble' },
                { id: 'review', label: 'Review' },
                { id: 'publish', label: 'Publish' },
              ]}
              series={loadingSeries}
              domain={[0, 100]}
              formatValue={formatTokens}
              height={180}
            />
          </AsyncRegion>
        )}
      </Panel>
      <Text variant="caption" tone="muted">
        This text follows the same chart frame in both states.
      </Text>
    </Stack>
  );
}

export const LoadingGeometry: Story = { render: () => <BarLoadingGeometry /> };

export const NarrowLoadingGeometry: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <BarLoadingGeometry />,
};
