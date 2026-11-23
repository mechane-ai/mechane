import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { DataTable } from '../../../collections/src/index.ts';
import type { DataTableColumn } from '../../../collections/src/index.ts';
import { themeProps } from '../../../foundations/src/theme.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ToneScope } from '../figure/tone-scope.tsx';
import { BarCell } from './bar-cell.tsx';
import { ChangeCell } from './change-cell.tsx';
import { HeatCell } from './heat-cell.tsx';
import { IntervalCell } from './interval-cell.tsx';
import { SparkCell } from './spark-cell.tsx';

const meta = {
  title: 'Charts/Table cells',
  component: BarCell,
  parameters: {
    docs: {
      description: {
        component:
          'Five compact graphics for a table cell: BarCell, IntervalCell, SparkCell, HeatCell and ChangeCell. Each is one text line tall, fills the width its cell gives it, takes no focus and shows no inspector. The exact value is always written beside the graphic in tabular numerals, and the graphic is hidden from assistive technology, so it is never the only carrier of the number. Pass the same `domain` to every row of a column so all rows share one scale. The cells take a declared format and an explicit locale. A missing value shows "Unavailable" and no mark, never zero. The example models and numbers are synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

type Model = {
  readonly id: string;
  readonly name: string;
  readonly passRate: number | null;
  readonly accuracy: number | null;
  readonly interval: readonly [number, number] | null;
  readonly loss: ReadonlyArray<number | null>;
  readonly safety: number | null;
  readonly change: number | null;
};

const styles = stylex.create({
  stack: { display: 'grid', gap: spacing.sm, maxWidth: 280, fontFamily: typography.fontFamily, color: colors.ink },
  caption: { color: colors.muted, fontSize: typography.captionSize },
  dark: { backgroundColor: colors.surface, padding: spacing.lg },
});

const percent = { style: 'percent', maximumFractionDigits: 1 } as const;
const points = { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' } as const;
const loss = { maximumFractionDigits: 2, minimumFractionDigits: 2 } as const;

function trace({ start, floor, rate }: { readonly start: number; readonly floor: number; readonly rate: number }) {
  return Array.from({ length: 12 }, (_, step) => floor + (start - floor) * Math.exp(-rate * step));
}

const models: ReadonlyArray<Model> = [
  {
    id: 'atlas-7b',
    name: 'Atlas 7B',
    passRate: 0.62,
    accuracy: 0.71,
    interval: [0.67, 0.75],
    loss: trace({ start: 4.1, floor: 1.9, rate: 0.28 }),
    safety: 0.84,
    change: 0.031,
  },
  {
    id: 'atlas-13b',
    name: 'Atlas 13B',
    passRate: 0.74,
    accuracy: 0.79,
    interval: [0.76, 0.82],
    loss: trace({ start: 4, floor: 1.5, rate: 0.3 }),
    safety: 0.9,
    change: 0.012,
  },
  {
    id: 'borealis-3b',
    name: 'Borealis 3B',
    passRate: 0.38,
    accuracy: 0.55,
    interval: [0.46, 0.64],
    loss: [4.2, 3.9, null, null, 3.1, 2.9, 2.8, null, 2.6, 2.6, 2.5, 2.7],
    safety: 0.41,
    change: -0.024,
  },
  {
    id: 'cirrus-30b',
    name: 'Cirrus 30B',
    passRate: 0.81,
    accuracy: 0.88,
    interval: [0.85, 0.91],
    loss: trace({ start: 3.9, floor: 1.1, rate: 0.33 }),
    safety: 0.67,
    change: 0,
  },
  {
    id: 'draco-1b',
    name: 'Draco 1B',
    passRate: null,
    accuracy: null,
    interval: null,
    loss: [null, null, null, null, null, null, null, null, null, null, null, null],
    safety: null,
    change: null,
  },
];

const passDomain = [0, 1] as const;
const accuracyDomain = [0.4, 1] as const;
const lossDomain = [0, 5] as const;
const safetyDomain = [0, 1] as const;

function Stack({ title, children }: { readonly title: string; readonly children: ReactNode }): ReactNode {
  return (
    <div {...stylex.props(styles.stack)}>
      <span {...stylex.props(styles.caption)}>{title}</span>
      {children}
    </div>
  );
}

export const Bar: Story = {
  render: () => (
    <Stack title="Pass rate, domain 0 to 100%">
      <BarCell value={0.62} domain={passDomain} locale="en-US" format={percent} />
      <BarCell value={0.95} domain={passDomain} locale="en-US" format={percent} />
      <BarCell value={null} domain={passDomain} locale="en-US" format={percent} />
      <BarCell value={-0.4} domain={[-1, 1]} locale="en-US" format={percent} tone="negative" />
      <BarCell value={0.4} domain={[-1, 1]} locale="en-US" format={percent} tone="positive" />
    </Stack>
  ),
};

export const Interval: Story = {
  render: () => (
    <Stack title="Accuracy with a 95% interval, domain 40 to 100%">
      <IntervalCell value={0.71} interval={[0.67, 0.75]} domain={accuracyDomain} locale="en-US" format={percent} />
      <IntervalCell value={0.55} interval={[0.46, 0.64]} domain={accuracyDomain} locale="en-US" format={percent} />
      <IntervalCell value={0.88} domain={accuracyDomain} locale="en-US" format={percent} />
      <IntervalCell value={null} domain={accuracyDomain} locale="en-US" format={percent} />
    </Stack>
  ),
};

export const Spark: Story = {
  render: () => (
    <Stack title="Training loss over 12 evaluations, domain 0 to 5">
      <SparkCell points={models[0]?.loss ?? []} domain={lossDomain} locale="en-US" format={loss} />
      <SparkCell points={models[2]?.loss ?? []} domain={lossDomain} locale="en-US" format={loss} tone="series4" />
      <SparkCell points={[2.4, null]} domain={lossDomain} locale="en-US" format={loss} />
      <SparkCell points={models[4]?.loss ?? []} domain={lossDomain} locale="en-US" format={loss} />
      <SparkCell points={models[1]?.loss ?? []} domain={lossDomain} locale="en-US" format={loss} label="peak" />
    </Stack>
  ),
};

export const Heat: Story = {
  render: () => (
    <Stack title="Sequential, domain 0 to 100%, then diverging, domain -10 to 10 points">
      <HeatCell value={0.05} domain={safetyDomain} palette="sequential" locale="en-US" format={percent} />
      <HeatCell value={0.5} domain={safetyDomain} palette="sequential" locale="en-US" format={percent} />
      <HeatCell value={1} domain={safetyDomain} palette="sequential" locale="en-US" format={percent} />
      <HeatCell value={null} domain={safetyDomain} palette="sequential" locale="en-US" format={percent} />
      <HeatCell value={-0.1} domain={[-0.1, 0.1]} palette="diverging" locale="en-US" format={points} />
      <HeatCell value={0} domain={[-0.1, 0.1]} palette="diverging" locale="en-US" format={points} />
      <HeatCell value={0.1} domain={[-0.1, 0.1]} palette="diverging" locale="en-US" format={points} />
    </Stack>
  ),
};

export const Change: Story = {
  render: () => (
    <Stack title="Change against the last release">
      <ChangeCell value={0.031} positiveIs="good" locale="en-US" format={points} />
      <ChangeCell value={-0.024} positiveIs="good" locale="en-US" format={points} />
      <ChangeCell value={0.031} positiveIs="bad" locale="en-US" format={points} />
      <ChangeCell value={-0.024} positiveIs="bad" locale="en-US" format={points} />
      <ChangeCell value={0.031} positiveIs="neutral" locale="en-US" format={points} />
      <ChangeCell value={0} positiveIs="good" locale="en-US" format={points} />
      <ChangeCell value={null} positiveIs="good" locale="en-US" format={points} />
    </Stack>
  ),
};

const columns = [
  { id: 'model', label: 'Model', role: 'primary', cell: (row) => row.name },
  {
    id: 'passRate',
    label: 'Pass rate',
    role: 'number',
    width: 200,
    cell: (row) => <BarCell id={row.id} value={row.passRate} domain={passDomain} locale="en-US" format={percent} />,
  },
  {
    id: 'accuracy',
    label: 'Accuracy, 95% interval',
    role: 'number',
    width: 380,
    cell: (row) => (
      <IntervalCell
        id={row.id}
        value={row.accuracy}
        interval={row.interval}
        domain={accuracyDomain}
        locale="en-US"
        format={percent}
      />
    ),
  },
  {
    id: 'loss',
    label: 'Loss, last 12 evaluations',
    role: 'number',
    width: 200,
    cell: (row) => <SparkCell id={row.id} points={row.loss} domain={lossDomain} locale="en-US" format={loss} />,
  },
  {
    id: 'safety',
    label: 'Safety',
    role: 'number',
    width: 120,
    cell: (row) => (
      <HeatCell value={row.safety} domain={safetyDomain} palette="sequential" locale="en-US" format={percent} />
    ),
  },
  {
    id: 'change',
    label: 'Pass rate change',
    role: 'number',
    width: 140,
    cell: (row) => <ChangeCell value={row.change} positiveIs="good" locale="en-US" format={points} />,
  },
] satisfies ReadonlyArray<DataTableColumn<Model>>;

function ModelTable(): ReactNode {
  return (
    <ToneScope ids={models.map((model) => model.id)}>
      <DataTable
        query={{ mode: 'static', reason: 'Fixed example rows.' }}
        rows={models}
        columns={columns}
        getRowId={(model) => model.id}
        caption="Model evaluation, synthetic results"
        empty="No models."
      />
    </ToneScope>
  );
}

export const Table: Story = { render: () => <ModelTable /> };

export const TableDark: Story = {
  render: () => (
    <div {...themeProps.dark}>
      <div {...stylex.props(styles.dark)}>
        <ModelTable />
      </div>
    </div>
  ),
};
