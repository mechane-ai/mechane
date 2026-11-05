import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Stack } from '../../../core/src/index.ts';
import { ColorLegend } from './color-legend.tsx';
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
          'Matrix renders explicit row and column identities as a semantic table. Values, masked cells, unavailable cells, and values outside the color domain stay distinct. The application supplies normalization, units, and formatting. TokenHeatmap preserves exact text and supplied indices, including whitespace. Its underline indicates a score while keeping text readable in both themes. Selection is controlled. The render limits are 4,096 matrix coordinates and 2,048 tokens; larger inputs show an explicit error and must be windowed by the application. Invalid identifiers and nonfinite values also show an error. ColorLegend uses the same scale as the supplied values.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function formatValue(value: number): string {
  return numberFormat.format(value);
}

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
  const [selectedId, setSelectedId] = useState<string>();

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
        formatValue={formatValue}
        selection={{ selectedId, onSelect: setSelectedId }}
        emptyLabel="No attention values were supplied."
      />
    </Panel>
  );
}

function Tokens(): ReactNode {
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <Panel>
      <TokenHeatmap
        title="Token contributions"
        description="Synthetic signed attribution values supplied by an analysis. This is a seven-token window, with exact spaces, a newline, and a tab retained."
        tokens={tokens}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        formatValue={formatValue}
        selection={{ selectedId, onSelect: setSelectedId }}
        emptyLabel="No tokens were supplied."
      />
    </Panel>
  );
}

export const AttentionWeights: Story = { render: () => <Attention /> };
export const ExactTokenText: Story = { render: () => <Tokens /> };

export const ColorDomains: Story = {
  render: () => (
    <Stack>
      <ColorLegend label="Activation (unitless)" domain={[0, 3]} palette="sequential" formatValue={formatValue} />
      <ColorLegend label="Signed change (points)" domain={[-1, 2]} palette="diverging" formatValue={formatValue} />
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
        formatValue={formatValue}
        emptyLabel="No measurements."
      />
      <TokenHeatmap
        title="Out-of-domain token"
        description="A dotted underline and the data disclosure identify the value outside the color domain."
        tokens={[{ id: 'high', index: 0, text: 'High value', score: 2.5 }]}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        formatValue={formatValue}
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
        formatValue={formatValue}
        emptyLabel="No attention values were supplied."
      />
      <TokenHeatmap
        title="Token contributions"
        description="No values have been supplied."
        tokens={[]}
        domain={[-1, 1]}
        palette="diverging"
        valueLabel="Contribution (logit units)"
        formatValue={formatValue}
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
        formatValue={formatValue}
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
        formatValue={formatValue}
        emptyLabel="No tokens."
      />
    </Stack>
  ),
};

function LongMatrixLabels(): ReactNode {
  const [selectedId, onSelect] = useState<string>('the-map');

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
        formatValue={formatValue}
        selection={{ selectedId, onSelect }}
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
