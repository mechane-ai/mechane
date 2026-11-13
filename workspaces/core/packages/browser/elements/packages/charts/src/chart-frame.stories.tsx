import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SectionHeading, Stack } from '../../core/src/index.ts';
import { AsyncRegion } from '../../feedback/src/index.ts';
import { Select } from '../../forms/src/index.ts';
import { BarChart, BarChartPlaceholder } from './cartesian/index.ts';
import type { BarSeries } from './cartesian/index.ts';
import { ChartFrame } from './chart-frame.tsx';
import type { ChartSeriesReport } from './chart-frame.tsx';

const meta = {
  title: 'Charts/Report captions',
  component: ChartFrame,
  parameters: {
    docs: {
      description: {
        component:
          'A report uses a compact chart caption beneath the containing page or section heading. The report owns its subtle border and body inset. Supply local controls through report.actions with density="compact"; bar and time-series reports place their Chart data action after those controls. The dialog and independent page controls keep standard density. Use an ordinary chart when an existing region owns the boundary. Keep the same title, qualifications, controls and known series in the pending report. Long titles, metadata and actions wrap without clipping.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const operations = [
  { id: 'assemble', label: 'Assemble', input: 40, output: 25 },
  { id: 'review', label: 'Review', input: 70, output: 10 },
  { id: 'publish', label: 'Publish', input: 20, output: 0 },
];

const scopes = [
  { value: 'all', label: 'All operations' },
  { value: 'review', label: 'Review only' },
];

type ReportCaptionExampleProps = { readonly isPending?: boolean; readonly hasLongLabels?: boolean };

function formatTokens(value: number): string {
  return `${value} tokens`;
}

function ReportCaptionExample({ isPending = false, hasLongLabels = false }: ReportCaptionExampleProps): ReactNode {
  const [scope, setScope] = useState<string | null>('all');
  const selected = operations.filter((operation) => scope === 'all' || operation.id === scope);
  const inputTotal = selected.reduce((total, operation) => total + operation.input, 0);
  const outputTotal = selected.reduce((total, operation) => total + operation.output, 0);

  const series: ReadonlyArray<BarSeries> = [
    { id: 'input', label: 'Input', tone: 'series1', values: selected.map((operation) => operation.input) },
    { id: 'output', label: 'Output', tone: 'series2', values: selected.map((operation) => operation.output) },
  ];

  const title = hasLongLabels
    ? 'Recorded tokens across the complete validation, review and publication sequence'
    : 'Recorded tokens by operation';

  const qualification = hasLongLabels
    ? `Period totals · ${selected.length} supplied operations · synthetic observations for the complete six-minute reporting window`
    : `Period totals · ${selected.length} supplied operations`;

  const report: ChartSeriesReport = {
    meta: qualification,
    seriesValues: {
      input: isPending ? undefined : formatTokens(inputTotal),
      output: isPending ? undefined : formatTokens(outputTotal),
    },
    actions: (
      <Select.Root<string> items={scopes} value={scope} onValueChange={setScope}>
        <Select.Trigger density="compact" aria-label="Token report scope">
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={16} aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                {scopes.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
  };

  const placeholder = <BarChartPlaceholder title={title} report={report} series={series} height={180} />;

  return (
    <Stack isCompact>
      <SectionHeading title="Usage reports" meta="Synthetic reporting window" />
      {isPending ? (
        <AsyncRegion state="pending" label="Loading recorded token values" placeholder={placeholder} />
      ) : (
        <AsyncRegion state="ready" label="Loading recorded token values" placeholder={placeholder}>
          <BarChart
            title={title}
            report={report}
            categories={selected}
            series={series}
            domain={[0, 100]}
            formatValue={formatTokens}
            height={180}
          />
        </AsyncRegion>
      )}
    </Stack>
  );
}

export const LocalActions: Story = { render: () => <ReportCaptionExample /> };
export const Loading: Story = { render: () => <ReportCaptionExample isPending /> };

export const NarrowLongLabels: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <ReportCaptionExample hasLongLabels />,
};
