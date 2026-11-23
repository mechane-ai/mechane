import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { tileDescription, tilePicture } from '../../../../src/stories/image-fixtures.ts';
import { ChartGrid } from '../chart-grid.tsx';
import { ImageAtlas } from './image-atlas.tsx';
import type { ImageAtlasCell } from './image-atlas.tsx';

const meta = {
  title: 'Charts/ImageAtlas',
  component: ImageAtlas,
  parameters: {
    docs: {
      description: {
        component:
          'Thumbnails placed on a two-dimensional layout the application computed, such as an activation atlas. Positions are layout coordinates, not measured axes, and empty positions stay empty. Reading a cell shows its label, position and value without enlarging anything. These stories use synthetic pictures placed in closed form.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const COLUMNS = 8;
const ROWS = 5;

const atlasCells: ReadonlyArray<ImageAtlasCell> = Array.from({ length: COLUMNS * ROWS }, (_, index) => index)
  .filter((index) => (index * 7) % 5 !== 0)
  .map((index) => ({
    id: `cell-${index}`,
    column: index % COLUMNS,
    row: Math.floor(index / COLUMNS),
    src: tilePicture(index),
    alt: tileDescription(index),
    label: `Direction ${index + 1}`,
    value: Math.abs(Math.sin(index)),
  }));

export const ActivationAtlas: Story = {
  render: () => (
    <ImageAtlas
      title="Activation atlas"
      description="Synthetic pictures laid out by similarity of activation. Gaps are positions with no picture."
      locale="en-US"
      columns={COLUMNS}
      rows={ROWS}
      cells={atlasCells}
      xLabel="First layout direction"
      yLabel="Second layout direction"
      valueLabel="Activation"
      source="Synthetic layer 6 activations"
    />
  ),
};

function SelectableAtlas() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ImageAtlas
      locale="en-US"
      columns={COLUMNS}
      rows={ROWS}
      cells={atlasCells}
      title="Select a direction"
      description="Arrow keys move to the nearest picture in that direction. Enter selects."
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selectable: Story = { render: () => <SelectableAtlas /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look" minPanelWidth={360}>
      <ImageAtlas title="Loading" locale="en-US" status="loading" columns={2} rows={2} cells={[]} />
      <ImageAtlas title="Empty" locale="en-US" columns={2} rows={2} cells={[]} />
      <ImageAtlas
        title="Partial"
        locale="en-US"
        coverage={{ shown: 3, total: 4096, unit: 'cells' }}
        columns={3}
        rows={2}
        cells={atlasCells.slice(0, 3).map((cell, index) => ({ ...cell, column: index, row: index % 2 }))}
      />
      <ImageAtlas
        title="Invalid"
        locale="en-US"
        columns={3}
        rows={2}
        cells={[
          { id: 'a', column: 1, row: 1, src: tilePicture(0), alt: tileDescription(0) },
          { id: 'b', column: 1, row: 1, src: tilePicture(1), alt: tileDescription(1) },
        ]}
      />
    </ChartGrid>
  ),
};
