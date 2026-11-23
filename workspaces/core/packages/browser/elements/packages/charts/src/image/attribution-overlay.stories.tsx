import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  sceneContrast,
  sceneDetails,
  sceneGrid,
  sceneSaliency,
  sceneSource,
} from '../../../../src/stories/image-fixtures.ts';
import { ChartGrid } from '../chart-grid.tsx';
import { AttributionOverlay } from './attribution-overlay.tsx';

const scenePicture = { src: sceneSource, ...sceneDetails };

const meta = {
  title: 'Charts/AttributionOverlay',
  component: AttributionOverlay,
  parameters: {
    docs: {
      description: {
        component:
          'A picture with a grid of values laid over it, such as a saliency or attention map over image patches. Hue and lightness carry the value; the reader sets how strongly the overlay covers the picture. A cell with no value is hollow. The application supplies the picture, the row by row values and the color domain. These stories use a synthetic picture and synthetic values.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const score = { maximumFractionDigits: 2 } as const;
const MASKED_FROM = 58;
const MASKED_COUNT = 4;

const masked = sceneSaliency.map((value, index) =>
  index >= MASKED_FROM && index < MASKED_FROM + MASKED_COUNT ? null : value,
);

export const Saliency: Story = {
  render: () => (
    <AttributionOverlay
      title="Saliency by patch"
      description='Synthetic gradient saliency for the class "house". Darker blue means a larger effect on the score; dashed cells have no value.'
      locale="en-US"
      image={scenePicture}
      grid={{ ...sceneGrid, values: masked }}
      valueLabel="Saliency"
      valueFormat={score}
      domain={[0, 1]}
      palette="sequential"
      source="Synthetic gradients"
    />
  ),
};

function AdjustableOverlay() {
  const [opacity, setOpacity] = useState(0.7);

  return (
    <AttributionOverlay
      locale="en-US"
      image={scenePicture}
      valueFormat={score}
      title="Signed attribution"
      description="Synthetic. Blue pushes the score up, red pushes it down. The application holds the overlay strength."
      grid={{ ...sceneGrid, values: sceneContrast }}
      valueLabel="Contribution to score"
      domain={[-1, 1]}
      palette="diverging"
      opacity={opacity}
      onOpacityChange={(next) => setOpacity(next)}
    />
  );
}

export const SignedAttribution: Story = { render: () => <AdjustableOverlay /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look" minPanelWidth={360}>
      <AttributionOverlay
        title="Loading"
        locale="en-US"
        status="loading"
        image={scenePicture}
        grid={{ columns: 1, rows: 1, values: [0] }}
        valueLabel="Saliency"
        valueFormat={score}
        domain={[0, 1]}
        palette="sequential"
      />
      <AttributionOverlay
        title="Partial"
        locale="en-US"
        coverage={{ shown: 140, total: 1400, unit: 'patches' }}
        image={scenePicture}
        grid={{ ...sceneGrid, values: sceneSaliency }}
        valueLabel="Saliency"
        valueFormat={score}
        domain={[0, 1]}
        palette="sequential"
      />
      <AttributionOverlay
        title="Invalid"
        locale="en-US"
        image={scenePicture}
        grid={{ columns: 14, rows: 10, values: [0.5, 0.2] }}
        valueLabel="Saliency"
        valueFormat={score}
        domain={[0, 1]}
        palette="sequential"
      />
    </ChartGrid>
  ),
};
