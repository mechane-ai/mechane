import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { tileDescription, tilePicture } from '../../../../src/stories/image-fixtures.ts';
import { ChartGrid } from '../chart-grid.tsx';
import { ImageGrid } from './image-grid.tsx';
import type { ImageGridItem } from './image-grid.tsx';

const meta = {
  title: 'Charts/ImageGrid',
  component: ImageGrid,
  parameters: {
    docs: {
      description: {
        component:
          'A ranked grid of image tiles, such as the dataset examples that most activate a feature. Tiles keep the supplied order and show their value beneath. Use it when a reader needs to see what the images share. The application supplies the images, their alt text, their order and their values. These stories use synthetic pictures and values.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const EXAMPLE_COUNT = 18;
const TOP_ACTIVATION = 9.4;
const DECAY = 0.92;

const examples: ReadonlyArray<ImageGridItem> = Array.from({ length: EXAMPLE_COUNT }, (_, index) => ({
  id: `example-${index + 1}`,
  src: tilePicture(index),
  alt: tileDescription(index),
  label: `#${index + 1}`,
  value: TOP_ACTIVATION * DECAY ** index,
}));

export const TopActivations: Story = {
  render: () => (
    <ImageGrid
      title="Top activating examples"
      description="Synthetic examples ranked by how strongly feature 4,127 fires on them."
      locale="en-US"
      items={examples}
      valueLabel="Activation"
      source="Synthetic dataset"
      transforms={['Top 18 of the validation split']}
    />
  ),
};

function SelectableGrid() {
  const [selected, setSelected] = useState<string | null>('example-3');

  return (
    <ImageGrid
      title="Choose an example"
      locale="en-US"
      items={examples.slice(0, 12)}
      description="Press a tile, or move with the arrow keys and press Enter. The selected tile has an outline."
      aspectRatio={4 / 3}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selectable: Story = { render: () => <SelectableGrid /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look" minPanelWidth={360}>
      <ImageGrid title="Loading" locale="en-US" status="loading" items={[]} />
      <ImageGrid title="Empty" locale="en-US" items={[]} />
      <ImageGrid
        title="Partial"
        locale="en-US"
        coverage={{ shown: 6, total: 50_000, unit: 'examples' }}
        items={examples.slice(0, 6)}
        columns={3}
      />
      <ImageGrid
        title="One image fails to load"
        description="The tile keeps its size and shows a neutral placeholder."
        locale="en-US"
        columns={3}
        items={[
          { id: 'ok', src: tilePicture(0), alt: tileDescription(0), value: 3.2 },
          { id: 'broken', src: 'data:image/png;base64,AAAA', alt: 'A picture that could not be loaded', value: 2.9 },
          { id: 'ok-2', src: tilePicture(1), alt: tileDescription(1), value: null },
        ]}
      />
      <ImageGrid title="Invalid" locale="en-US" items={[{ id: 'bare', src: tilePicture(0), alt: '', value: 1 }]} />
    </ChartGrid>
  ),
};
