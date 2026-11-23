import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import type { MeasureDimension, MeasureRow } from './measures.ts';
import { ScatterMatrix } from './scatter-matrix.tsx';

const meta = {
  title: 'Charts/ScatterMatrix',
  component: ScatterMatrix,
  parameters: {
    docs: {
      description: {
        component:
          'Every pair of a few measures as small scatter panels, with each measure named on the diagonal and shared axes on the outer edges. Pointing at a dot marks the same row in every panel, and a row with a missing value is left out of the panels that need it. The application supplies two to six dimensions and up to 500 rows; the stories use synthetic model measurements.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const families = [
  { id: 'dense', label: 'Dense', speed: 1, skill: 0 },
  { id: 'sparse', label: 'Sparse', speed: 0.6, skill: -0.03 },
  { id: 'distilled', label: 'Distilled', speed: 0.45, skill: -0.08 },
] as const;

const FAMILY_SIZE = 10;

function models(): ReadonlyArray<MeasureRow> {
  return families.flatMap((family, familyIndex) =>
    Array.from({ length: FAMILY_SIZE }, (_, index) => {
      const size = 0.4 * 1.55 ** index;
      const wobble = Math.sin(index * 2.3 + familyIndex * 1.7);
      const isMissing = family.id === 'sparse' && index === 4;

      return {
        id: `${family.id}-${index}`,
        label: `${family.label} ${index + 1}`,
        group: family.id,
        values: {
          size,
          latency: isMissing ? null : (6 + 9 * size ** 0.6) * family.speed * (1 + 0.04 * wobble),
          accuracy: 0.5 + 0.4 * (1 - Math.exp(-size / 8)) + family.skill + 0.01 * wobble,
          cost: 0.04 * size ** 0.85 * (family.id === 'distilled' ? 0.5 : 1),
        },
      };
    }),
  );
}

const dimensions: ReadonlyArray<MeasureDimension> = [
  { id: 'size', label: 'Size (B parameters)', scale: 'log', domain: [0.1, 100], format: { maximumFractionDigits: 1 } },
  { id: 'latency', label: 'Latency (ms)', domain: [0, 200], format: { maximumFractionDigits: 0 } },
  { id: 'accuracy', label: 'Accuracy', domain: [0.4, 1], format: { style: 'percent', maximumFractionDigits: 1 } },
  {
    id: 'cost',
    label: 'Cost ($ per 1M tokens)',
    scale: 'log',
    domain: [0.005, 10],
    format: { maximumFractionDigits: 2 },
  },
];

const groups = families.map((family) => ({ id: family.id, label: family.label }));

export const ModelMeasures: Story = {
  render: () => (
    <ScatterMatrix
      title="Model measures"
      description="Synthetic models in three families. One Sparse model has no latency measurement, so it is absent from the latency panels."
      locale="en-US"
      dimensions={dimensions}
      rows={models()}
      groups={groups}
      source="Synthetic benchmark"
    />
  ),
};

function Interactive(): ReactNode {
  const [selected, setSelected] = useState<string | null>('dense-6');

  return (
    <ScatterMatrix
      title="Select a model"
      description="Press a dot, or step with the arrow keys and press Enter. The row stays marked in every panel."
      locale="en-US"
      dimensions={dimensions.slice(0, 3)}
      rows={models()}
      groups={groups}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selectable: Story = { render: () => <Interactive /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look" minPanelWidth={420}>
      <ScatterMatrix
        title="Loading"
        locale="en-US"
        status="loading"
        dimensions={dimensions}
        rows={[]}
        height="compact"
      />
      <ScatterMatrix title="Empty" locale="en-US" dimensions={dimensions} rows={[]} height="compact" />
      <ScatterMatrix
        title="Partial"
        locale="en-US"
        dimensions={dimensions}
        rows={models()}
        groups={groups}
        coverage={{ shown: 30, total: 1200, unit: 'models' }}
        height="compact"
      />
      <ScatterMatrix
        title="Invalid"
        locale="en-US"
        dimensions={dimensions.slice(0, 1)}
        rows={models()}
        height="compact"
      />
    </ChartGrid>
  ),
};
