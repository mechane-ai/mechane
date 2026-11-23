import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Panel, Row, Stack, Text } from '../../../core/src/index.ts';
import { AsyncRegion } from '../../../feedback/src/index.ts';
import type { BreakdownItem } from '../categorical-values.tsx';
import { ChartFrame, ChartLegend } from '../chart-frame.tsx';
import type { ChartRangeValue } from '../chart-range.tsx';
import { BarChart, BarChartPlaceholder } from './bar-chart.tsx';
import type { BarSeries } from './bar-chart.tsx';
import { BreakdownBar } from './breakdown-bar.tsx';
import { Sparkline } from './sparkline.tsx';
import type { TimeSeries } from './time-series-data.ts';
import {
  AreaChart,
  LineChart,
  SmallMultiples,
  SmallMultiplesPlaceholder,
  TimeSeriesChartPlaceholder,
} from './time-series.tsx';

const meta = {
  title: 'Charts/Cartesian',
  component: LineChart,
  subcomponents: {
    AreaChart,
    Sparkline,
    SmallMultiples,
    SmallMultiplesPlaceholder,
    TimeSeriesChartPlaceholder,
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
          'Choose LineChart for trends, AreaChart for magnitude or explicit stacking, BarChart for category comparison, and BreakdownBar for nonnegative parts of a whole. Sparkline is a passive inline trend with a supplied summary and domain. Use SmallMultiples when readers compare the same timestamps across panels with independent units and populations. Its placeholder preserves the group layout and bottom date axis. A local selector can present alternate analytical questions. Stack related report sections. Use report for a self-contained analytical boundary, report.summary for mixed metrics, or report.seriesValues for period values keyed by the chart series. Embedded charts can use their ordinary frame inside an existing region. Full charts own their title, legend and inspection. ChartFrame supplies title, summary, action and footer layout for custom plots, whose renderers compose geometry, legend and inspection. Pointer, touch and keyboard users can inspect exact values. Escape dismisses details, and the heading’s accessible exact-value table returns focus when closed. Values use valueFormat and instants use timeFormat, in the figure’s locale; tickFormat overrides the compact axis form. Applications own observations, scope, units and formats. Supply the same title, metadata, series identity and height to the pending chart through AsyncRegion. Unknown bar-series identity uses a neutral legend skeleton.',
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

const MILLISECONDS_PER_SECOND = 1000;

/** Writes an elapsed time, which the chart passes in milliseconds, in seconds. */
function secondsText(milliseconds: number): string {
  return `${milliseconds / MILLISECONDS_PER_SECOND} s`;
}

/** Writes an elapsed time as a full clock time in the synthetic session that starts at 09:00 UTC. */
function clockText(milliseconds: number): string {
  const seconds = milliseconds / MILLISECONDS_PER_SECOND;
  const minute = String(Math.floor(seconds / 60)).padStart(2, '0');

  return `2026-11-05 09:${minute}:${String(seconds % 60).padStart(2, '0')} UTC`;
}

const latency = { style: 'unit', unit: 'millisecond' } as const;

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
        locale="en-US"
        description="Synthetic observations. The baseline has a missing sample at 90 seconds; elapsed-time spacing remains visible."
        series={[baseline, candidate]}
        timestampUnit="seconds"
        timeFormat={secondsText}
        valueFormat={latency}
        valueLabel="Latency (ms)"
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

function SelectTimeRange(): ReactNode {
  const [range, setRange] = useState<ChartRangeValue | null>([90, 180]);
  const selected = range === null ? times : times.filter((time) => time >= range[0] && time <= range[1]);

  return (
    <Panel>
      <Stack>
        <LineChart
          title="Request latency"
          locale="en-US"
          description="Drag on the plot to select a range of time. Drag the range to move it, or an edge to resize it. With the keyboard, Tab to the range, then use the arrow keys, Shift with an arrow, and Delete."
          series={[baseline, candidate]}
          timestampUnit="seconds"
          timeFormat={secondsText}
          valueFormat={latency}
          range={range}
          onRangeChange={setRange}
          rangeStep={30}
        />
        <Text tone="muted">
          The application owns the range. Here it counts {selected.length} of {times.length} observations.
        </Text>
      </Stack>
    </Panel>
  );
}

/** A range of time the application owns, drawn and adjusted on the plot. */
export const TimeRange: Story = { render: () => <SelectTimeRange /> };

export const TimeSeriesLoading: Story = {
  render: () => (
    <AsyncRegion
      state="pending"
      label="Loading request latency"
      placeholder={<TimeSeriesChartPlaceholder title="Request latency" locale="en-US" series={[baseline, candidate]} />}
    />
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
        locale="en-US"
        series={series}
        timestampUnit="seconds"
        timeFormat={secondsText}
        valueFormat={latency}
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
        locale="en-US"
        description="Each area begins at zero. Values are supplied observations, not inferred samples."
        series={[candidate]}
        timestampUnit="seconds"
        timeFormat={secondsText}
        valueFormat={formatTokens}
        tickFormat={{ maximumFractionDigits: 0 }}
        valueLabel="Tokens"
      />
      <AreaChart
        title="Additive token counts"
        locale="en-US"
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
        timeFormat={secondsText}
        valueFormat={formatTokens}
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
      <Sparkline
        title="Candidate latency"
        summary="Seven synthetic observations over six minutes range from 9 to 18 milliseconds, ending at 16."
        unit="milliseconds"
        series={candidate}
        timestampUnit="seconds"
        valueDomain={[0, 24]}
        markedPoints={['minimum', 'maximum', 'last']}
        layout="figure"
      />
    </Stack>
  ),
};

export const AlignedMetrics: Story = {
  render: () => (
    <SmallMultiples
      charts={[
        {
          id: 'request',
          title: 'Request latency',
          series: [baseline],
          valueFormat: latency,
          valueLabel: 'Latency (ms)',
          bands: [
            {
              id: 'request-range',
              label: 'Expected',
              rangeLabel: 'Seed range',
              tone: 'series1',
              points: times.map((timestamp, index) => {
                const center = [12, 15, 16, 15, 18, 20, 21][index] ?? null;

                return {
                  timestamp,
                  center,
                  lower: center === null ? null : center - 2,
                  upper: center === null ? null : center + 2,
                };
              }),
            },
          ],
        },
        {
          id: 'processing',
          title: 'Processing latency',
          series: [candidate],
          valueFormat: latency,
          valueLabel: 'Latency (ms)',
        },
      ]}
      timestampUnit="seconds"
      timeFormat={secondsText}
      locale="en-US"
      height="compact"
    />
  ),
};

function AlignedReportsExample({ isPending = false }: { readonly isPending?: boolean }): ReactNode {
  const charts = [
    {
      id: 'latency',
      title: 'Request latency',
      series: [baseline, candidate],
      valueFormat: latency,
      report: {
        meta: 'Period mean · baseline 6/7, candidate 7/7 observations · 6 minutes',
        seriesValues: { baseline: isPending ? undefined : '17.3 ms', candidate: isPending ? undefined : '14.1 ms' },
      },
    },
    {
      id: 'output',
      title: 'Output tokens',
      series: [
        {
          ...candidate,
          id: 'output',
          label: 'Output',
          tone: 'series2',
          points: candidate.points.map((point) => ({
            ...point,
            value: point.value === null ? null : point.value * 10,
          })),
        },
      ] as const,
      valueFormat: formatTokens,
      report: {
        meta: 'Period mean · 7/7 output observations · 6 minutes',
        seriesValues: { output: isPending ? undefined : '141 tokens' },
      },
    },
  ];

  const placeholder = <SmallMultiplesPlaceholder charts={charts} height="compact" locale="en-US" />;

  if (isPending) {
    return <AsyncRegion state="pending" label="Loading analytical reports" placeholder={placeholder} />;
  }

  return (
    <AsyncRegion state="ready" label="Loading analytical reports" placeholder={placeholder}>
      <SmallMultiples
        charts={charts}
        timestampUnit="seconds"
        timeFormat={secondsText}
        locale="en-US"
        height="compact"
      />
    </AsyncRegion>
  );
}

export const AlignedReports: Story = { render: () => <AlignedReportsExample /> };
export const AlignedReportsLoading: Story = { render: () => <AlignedReportsExample isPending /> };

export const CategoricalSeries: Story = {
  render: () => (
    <Stack>
      <BarChart
        title="Tokens by operation"
        locale="en-US"
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
        valueFormat={formatTokens}
        tickFormat={{ maximumFractionDigits: 0 }}
        valueLabel="Tokens"
      />
      <BarChart
        title="Additive tokens by operation"
        locale="en-US"
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
        valueFormat={formatTokens}
      />
    </Stack>
  ),
};

export const MissingSingleAndEmpty: Story = {
  render: () => (
    <Stack>
      <LineChart
        title="One observation"
        locale="en-US"
        series={[{ id: 'single', label: 'Recorded latency', points: [{ timestamp: 30, value: 0 }] }]}
        timestampUnit="seconds"
        timeFormat={secondsText}
        valueFormat={latency}
      />
      <LineChart
        title="No observations"
        locale="en-US"
        series={[]}
        timestampUnit="seconds"
        timeFormat={secondsText}
        valueFormat={latency}
      />
      <BreakdownBar
        title="Unavailable usage"
        locale="en-US"
        items={[
          { id: 'input', label: 'Input', value: null },
          { id: 'output', label: 'Output', value: 0 },
        ]}
        total={0}
        valueFormat={formatTokens}
      />
    </Stack>
  ),
};

export const InvalidEvidence: Story = {
  render: () => (
    <Stack>
      <LineChart
        title="Mismatched period values"
        locale="en-US"
        report={{ seriesValues: { misspelled: '17 ms' } }}
        series={[baseline]}
        timestampUnit="seconds"
        timeFormat={secondsText}
        valueFormat={latency}
      />
      <LineChart
        title="Unsorted timestamps"
        locale="en-US"
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
        timeFormat={secondsText}
        valueFormat={latency}
      />
      <BreakdownBar
        title="Inconsistent total"
        locale="en-US"
        items={allocation}
        total={1000}
        valueFormat={formatTokens}
      />
    </Stack>
  ),
};

function NarrowInspection(): ReactNode {
  const [selectedId, onSelect] = useState<string>('review');

  return (
    <Stack>
      <LineChart
        title="Latency across the complete validation and review sequence"
        locale="en-US"
        description="Synthetic observations with full timestamps and long series labels."
        series={[
          { ...baseline, label: 'Baseline across the complete validation sequence' },
          { ...candidate, label: 'Candidate across the complete validation sequence' },
        ]}
        timestampUnit="seconds"
        timeFormat={clockText}
        valueFormat={latency}
      />
      <BarChart
        title="Recorded tokens by operation"
        locale="en-US"
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
        valueFormat={formatTokens}
        selected={selectedId}
        onSelectedChange={onSelect}
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
        <Text>Marked range</Text>
        <Sparkline
          title="Candidate latency"
          summary="Latency ranged from 9 to 18 milliseconds and ended at 16, above the 14 millisecond objective."
          unit="milliseconds"
          timestampUnit="seconds"
          series={candidate}
          valueDomain={[0, 24]}
          markedPoints={['minimum', 'maximum', 'last']}
          baseline={14}
        />
      </Row>
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
      <Sparkline
        title="Candidate latency"
        summary="Seven synthetic observations over six minutes range from 9 to 18 milliseconds, ending at 16."
        unit="milliseconds"
        series={candidate}
        timestampUnit="seconds"
        valueDomain={[0, 24]}
        markedPoints={['minimum', 'maximum', 'last']}
        layout="figure"
      />
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
      <Sparkline
        title="Candidate latency"
        summary="Seven synthetic observations over six minutes range from 9 to 18 milliseconds, ending at 16."
        unit="milliseconds"
        series={candidate}
        timestampUnit="seconds"
        valueDomain={[0, 24]}
        markedPoints={['minimum', 'maximum', 'last']}
        layout="figure"
      />
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
      <Sparkline
        title="Candidate latency"
        summary="Seven synthetic observations over six minutes range from 9 to 18 milliseconds, ending at 16."
        unit="milliseconds"
        series={candidate}
        timestampUnit="seconds"
        valueDomain={[0, 24]}
        markedPoints={['minimum', 'maximum', 'last']}
        layout="figure"
      />
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
              <BarChartPlaceholder
                title={title}
                locale="en-US"
                description={description}
                series={knownSeries}
                height="compact"
              />
            }
          />
        ) : (
          <AsyncRegion
            state="ready"
            label="Loading recorded token values"
            placeholder={
              <BarChartPlaceholder
                title={title}
                locale="en-US"
                description={description}
                series={knownSeries}
                height="compact"
              />
            }
          >
            <BarChart
              title={title}
              locale="en-US"
              description={description}
              categories={[
                { id: 'assemble', label: 'Assemble' },
                { id: 'review', label: 'Review' },
                { id: 'publish', label: 'Publish' },
              ]}
              series={loadingSeries}
              domain={[0, 100]}
              valueFormat={formatTokens}
              height="compact"
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

export const UnknownSeriesLoading: Story = {
  render: () => <BarChartPlaceholder title="Daily spend" locale="en-US" report={{}} height="regular" />,
};

function CompositionExample(): ReactNode {
  const series: ReadonlyArray<BarSeries> = [
    { id: 'compute', label: 'Compute', tone: 'series1', values: [70, 55, 7, 0, 50] },
    { id: 'storage', label: 'Storage', tone: 'series2', values: [30, -5, null, null, 20] },
  ];

  const [focused, setFocused] = useState<string>();
  const [highlighted, setHighlighted] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const focus = series.find((item) => item.id === focused);

  return (
    <Stack>
      <Row>
        {series.map((item) => (
          <Button
            key={item.id}
            aria-pressed={focused === item.id}
            onPointerEnter={() => setHighlighted(item.id)}
            onPointerLeave={() => setHighlighted(undefined)}
            onFocus={() => setHighlighted(item.id)}
            onBlur={() => setHighlighted(undefined)}
            onClick={() => setFocused(focused === item.id ? undefined : item.id)}
          >
            {item.label}
          </Button>
        ))}
      </Row>
      <BarChart
        title="Reported daily usage"
        locale="en-US"
        categories={['1', '2', '3', '4', '5'].map((id) => ({ id, label: `Day ${id}` }))}
        series={series}
        domain={[-10, 110]}
        valueFormat={{ style: 'currency', currency: 'USD' }}
        tickFormat={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
        highlighted={highlighted ?? null}
        selected={selected ?? null}
        onSelectedChange={setSelected}
        composition={{
          contextLabel: 'Account total',
          focusedSeries: focus,
          buckets: [
            { kind: 'parts', total: 100 },
            { kind: 'total', total: 50 },
            { kind: 'gap' },
            { kind: 'parts', total: 0 },
            { kind: 'total', total: 80 },
          ],
        }}
      />
    </Stack>
  );
}

export const ComposedBars: Story = { render: () => <CompositionExample /> };
