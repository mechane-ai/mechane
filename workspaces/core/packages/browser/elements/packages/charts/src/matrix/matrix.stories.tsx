import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Stack } from '../../../core/src/index.ts';
import { ColorLegend } from './color-legend.tsx';
import type { MatrixCellRange } from './matrix-types.ts';
import { Matrix } from './matrix.tsx';
import type { MatrixAxisItem, MatrixCell } from './matrix.tsx';
import { TokenHeatmap } from './token-heatmap.tsx';
import type { HeatmapToken } from './token-heatmap.tsx';

const meta = {
  title: 'Charts/Matrix and tokens',
  component: Matrix,
  subcomponents: { TokenHeatmap, ColorLegend },
  parameters: {
    docs: {
      description: {
        component:
          'Matrix renders explicit row and column identities as a semantic table. A reader marks a block with Shift and the arrow keys or a drag and copies it as tab-separated exact values; the block is application state. The strip variant draws the same cells as compact intensity rows that fill the width, such as months across categories; Up and Down move between rows. Values, masked cells, unavailable cells, and values outside the color domain stay distinct. The application supplies normalization, units, and formatting. TokenHeatmap preserves exact text and supplied indices, including whitespace. Its underline indicates a score while keeping text readable in both themes. Selection is controlled. The render limits are 4,096 matrix coordinates and 2,048 tokens; larger inputs show an explicit error and must be windowed by the application. Invalid identifiers and nonfinite values also show an error. ColorLegend uses the same scale as the supplied values.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const valueFormat = { maximumFractionDigits: 2, minimumFractionDigits: 2 } as const;
const locale = 'en-US';

const axes: ReadonlyArray<MatrixAxisItem> = [
  { id: 'the', label: 'The' },
  { id: 'map', label: ' map' },
  { id: 'shows', label: ' shows' },
  { id: 'roads', label: ' roads' },
];

const attention: ReadonlyArray<MatrixCell> = [
  { id: 'the-the', rowId: 'the', columnId: 'the', kind: 'value', value: 1 },
  { id: 'the-map', rowId: 'the', columnId: 'map', kind: 'masked', reason: 'Future token' },
  { id: 'the-shows', rowId: 'the', columnId: 'shows', kind: 'masked', reason: 'Future token' },
  { id: 'the-roads', rowId: 'the', columnId: 'roads', kind: 'masked', reason: 'Future token' },
  { id: 'map-the', rowId: 'map', columnId: 'the', kind: 'value', value: 0.3 },
  { id: 'map-map', rowId: 'map', columnId: 'map', kind: 'value', value: 0.7 },
  { id: 'map-shows', rowId: 'map', columnId: 'shows', kind: 'masked', reason: 'Future token' },
  { id: 'map-roads', rowId: 'map', columnId: 'roads', kind: 'masked', reason: 'Future token' },
  { id: 'shows-the', rowId: 'shows', columnId: 'the', kind: 'value', value: 0 },
  { id: 'shows-map', rowId: 'shows', columnId: 'map', kind: 'value', value: 0.65 },
  { id: 'shows-shows', rowId: 'shows', columnId: 'shows', kind: 'value', value: 0.35 },
  { id: 'shows-roads', rowId: 'shows', columnId: 'roads', kind: 'masked', reason: 'Future token' },
  { id: 'roads-the', rowId: 'roads', columnId: 'the', kind: 'missing', reason: 'Not recorded' },
  { id: 'roads-map', rowId: 'roads', columnId: 'map', kind: 'missing', reason: 'Not recorded' },
  { id: 'roads-shows', rowId: 'roads', columnId: 'shows', kind: 'missing', reason: 'Not recorded' },
  { id: 'roads-roads', rowId: 'roads', columnId: 'roads', kind: 'missing', reason: 'Not recorded' },
];

const tokens: ReadonlyArray<HeatmapToken> = [
  { id: 'token-the', index: 21, text: 'The', score: -0.12 },
  { id: 'token-map', index: 22, text: ' map', score: 0.84 },
  { id: 'token-shows', index: 23, text: ' shows', score: 0 },
  { id: 'token-roads', index: 24, text: ' roads', score: 0.42 },
  { id: 'token-period', index: 25, text: '.\n', score: null },
  { id: 'token-tab', index: 26, text: '\t', score: 0 },
  { id: 'token-end', index: 27, text: 'A second line.', score: -0.67 },
];

function Attention(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);
  const [cellRange, setCellRange] = useState<MatrixCellRange | null>(null);

  return (
    <Panel>
      <Matrix
        title="Attention weights"
        description="Layer 3 · Head 2 · Prepared weights normalized by row. Future positions are masked; the final row was not recorded. Attention weights alone do not establish a causal explanation."
        rows={axes}
        columns={axes}
        cells={attention}
        domain={[0, 1]}
        palette="sequential"
        valueLabel="Attention weight (unitless)"
        valueFormat={valueFormat}
        locale={locale}
        selected={selected}
        onSelectedChange={setSelected}
        cellRange={cellRange}
        onCellRangeChange={setCellRange}
        emptyLabel="No attention values were supplied."
      />
    </Panel>
  );
}

function Tokens(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Panel>
      <TokenHeatmap
        title="Token contributions"
        description="Synthetic signed attribution values supplied by an analysis. This is a seven-token window, with exact spaces, a newline, and a tab retained."
        tokens={tokens}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        valueFormat={valueFormat}
        locale={locale}
        selected={selected}
        onSelectedChange={setSelected}
      />
    </Panel>
  );
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label) => ({ id: label.toLowerCase(), label, axisLabel: label.slice(0, 1) }));

const seasonalRows: ReadonlyArray<MatrixAxisItem> = [
  { id: 'heating', label: 'Heating' },
  { id: 'travel', label: 'Travel' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'school', label: 'School supplies' },
];

const seasonalShares: Readonly<Record<string, ReadonlyArray<number | null>>> = {
  heating: [2.1, 1.9, 1.4, 0.8, 0.3, 0.1, 0, 0, 0.3, 0.9, 1.7, 2.4],
  travel: [0.4, 0.5, 1.2, 0.8, 0.9, 1.8, 2.6, 2.2, 0.7, 0.5, 0.6, 1.1],
  gifts: [0.3, 0.6, 0.2, 0.3, 0.8, 0.4, 0.2, 0.3, 0.4, 0.6, 1.9, 4.9],
  gardening: [0, 0.1, 1.3, 2.4, 2.8, 1.9, 1.2, 0.9, 0.6, 0.4, null, 0],
  school: [0.6, 0.2, 0.1, 0.1, 0.1, 0.2, 0.9, 4.6, 3.1, 0.3, 0.2, 0.2],
};

const seasonalCells: ReadonlyArray<MatrixCell> = seasonalRows.flatMap((row) =>
  months.map((month, index): MatrixCell => {
    const value = seasonalShares[row.id]?.[index] ?? null;
    const id = `${row.id}-${month.id}`;

    if (value === null) {
      return { id, rowId: row.id, columnId: month.id, kind: 'missing', reason: 'Not planned yet' };
    }

    return { id, rowId: row.id, columnId: month.id, kind: 'value', value };
  }),
);

const shareNumber = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

function formatShare(value: number): string {
  return `${shareNumber.format(value)}× monthly average`;
}

function SeasonalStrip(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Panel>
      <Matrix
        title="Seasonal spending"
        description="Synthetic plan. Each cell is a month's planned spending divided by that category's monthly average, so 1× is a typical month. November gardening has no plan yet."
        rows={seasonalRows}
        columns={months}
        cells={seasonalCells}
        domain={[0, 5]}
        palette="sequential"
        valueLabel="Month compared with the category average"
        valueFormat={formatShare}
        locale={locale}
        selected={selected}
        onSelectedChange={setSelected}
        emptyLabel="No seasonal plan was supplied."
        variant="strip"
      />
    </Panel>
  );
}

export const AttentionWeights: Story = { render: () => <Attention /> };
export const CompactStrip: Story = { render: () => <SeasonalStrip /> };
export const ExactTokenText: Story = { render: () => <Tokens /> };

export const ColorDomains: Story = {
  render: () => (
    <Stack>
      <ColorLegend
        label="Activation (unitless)"
        domain={[0, 3]}
        palette="sequential"
        valueFormat={valueFormat}
        locale={locale}
      />
      <ColorLegend
        label="Signed change (points)"
        domain={[-1, 2]}
        palette="diverging"
        valueFormat={valueFormat}
        locale={locale}
      />
    </Stack>
  ),
};

export const ValuesOutsideDomain: Story = {
  render: () => (
    <Stack>
      <Matrix
        title="Declared display domain"
        description="Out-of-domain values retain their exact value and receive no saturated color."
        rows={[{ id: 'the', label: 'The' }]}
        columns={[{ id: 'the', label: 'The' }]}
        cells={[{ id: 'outside', rowId: 'the', columnId: 'the', kind: 'value', value: 1.4 }]}
        domain={[0, 1]}
        palette="sequential"
        valueLabel="Measured score (unitless)"
        valueFormat={valueFormat}
        locale={locale}
        emptyLabel="No measurements."
      />
      <TokenHeatmap
        title="Out-of-domain token"
        description="A dotted underline and the data disclosure identify the value outside the color domain."
        tokens={[{ id: 'high', index: 0, text: 'High value', score: 2.5 }]}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        valueFormat={valueFormat}
        locale={locale}
        emptyLabel="No tokens."
      />
    </Stack>
  ),
};

export const Empty: Story = {
  render: () => (
    <Stack>
      <Matrix
        title="Attention weights"
        description="No values have been supplied."
        rows={[]}
        columns={[]}
        cells={[]}
        domain={[0, 1]}
        palette="sequential"
        valueLabel="Weight (unitless)"
        valueFormat={valueFormat}
        locale={locale}
        emptyLabel="No attention values were supplied."
      />
      <TokenHeatmap
        title="Token contributions"
        description="No values have been supplied."
        tokens={[]}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        valueFormat={valueFormat}
        locale={locale}
        emptyLabel="No tokens were supplied."
      />
    </Stack>
  ),
};

export const InvalidInput: Story = {
  render: () => (
    <Stack>
      <Matrix
        title="Invalid matrix input"
        description="Duplicate coordinates cannot overwrite recorded evidence."
        rows={axes}
        columns={axes}
        cells={[
          { id: 'first', rowId: 'the', columnId: 'the', kind: 'value', value: 1 },
          { id: 'second', rowId: 'the', columnId: 'the', kind: 'value', value: 0 },
        ]}
        domain={[0, 1]}
        palette="sequential"
        valueLabel="Weight (unitless)"
        valueFormat={valueFormat}
        locale={locale}
        emptyLabel="No cells."
      />
      <TokenHeatmap
        title="Invalid token input"
        description="Duplicate supplied token indices are rejected."
        tokens={[
          { id: 'first', index: 1, text: 'First', score: 0 },
          { id: 'second', index: 1, text: ' second', score: 0 },
        ]}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        valueFormat={valueFormat}
        locale={locale}
        emptyLabel="No tokens."
      />
    </Stack>
  ),
};

function LongMatrixLabels(): ReactNode {
  const [selected, setSelected] = useState<string | null>('the-map');

  const longAxes = axes.map((axis) => ({
    ...axis,
    label: `Prepared representation for ${JSON.stringify(axis.label)} in the selected sample`,
  }));

  return (
    <Stack>
      <Matrix
        title="Full labels in a compact matrix"
        description="Synthetic long labels remain available in selected values and View data."
        rows={longAxes}
        columns={longAxes}
        cells={attention}
        domain={[0, 1]}
        palette="sequential"
        valueLabel="Normalized attention weight for the selected layer and head"
        valueFormat={valueFormat}
        locale={locale}
        selected={selected}
        onSelectedChange={setSelected}
        emptyLabel="No values were supplied."
      />
      <Tokens />
    </Stack>
  );
}

export const NarrowLongLabels: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <LongMatrixLabels />,
};

const LAYER_COUNT = 24;
const layers = Array.from({ length: LAYER_COUNT }, (_, index) => ({ id: `layer-${index}`, label: `L${index}` }));

const similarity: ReadonlyArray<MatrixCell> = layers.flatMap((row, rowIndex) =>
  layers.map((column, columnIndex): MatrixCell => ({
    id: `${row.id}:${column.id}`,
    rowId: row.id,
    columnId: column.id,
    kind: 'value',
    value: Math.round(1000 * Math.exp(-Math.abs(rowIndex - columnIndex) / 6)) / 1000,
  })),
);

function BlockCopy(): ReactNode {
  const [cellRange, setCellRange] = useState<MatrixCellRange | null>({
    anchor: { rowId: 'layer-2', columnId: 'layer-2' },
    end: { rowId: 'layer-5', columnId: 'layer-6' },
  });

  return (
    <Matrix
      title="Representation similarity across layers"
      description="Synthetic linear CKA between the residual streams of 24 layers. Mark a block with Shift and the arrow keys, or drag across cells, then copy it into a spreadsheet."
      locale={locale}
      rows={layers}
      columns={layers}
      cells={similarity}
      domain={[0, 1]}
      palette="sequential"
      valueLabel="Linear CKA (unitless)"
      valueFormat={valueFormat}
      cellRange={cellRange}
      onCellRangeChange={setCellRange}
      source="Synthetic"
    />
  );
}

export const BlockSelection: Story = { render: () => <BlockCopy /> };
