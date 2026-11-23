import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '../../../core/src/index.ts';
import { ConfusionMatrix } from './confusion-matrix.tsx';
import type { MatrixCellRange } from './matrix-types.ts';

const meta = {
  title: 'Charts/ConfusionMatrix',
  component: ConfusionMatrix,
  parameters: {
    docs: {
      description: {
        component:
          'Counts of actual against predicted class for a classifier: rows are actual, columns predicted, and the outlined diagonal holds the correct predictions. Use it to see which classes a model confuses. The application supplies whole-number counts; with normalize="row" the chart divides each row by its own total and says so in the legend.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const classes = [
  { id: 'cat', label: 'cat' },
  { id: 'dog', label: 'dog' },
  { id: 'bird', label: 'bird' },
  { id: 'fish', label: 'fish' },
  { id: 'horse', label: 'horse' },
];

const counts: ReadonlyArray<ReadonlyArray<number>> = [
  [241, 38, 6, 0, 7],
  [12, 263, 2, 1, 22],
  [9, 3, 188, 14, 0],
  [0, 1, 11, 202, 0],
  [4, 31, 0, 0, 219],
];

export const Default: Story = {
  render: () => (
    <ConfusionMatrix
      title="Image classifier errors"
      description="Synthetic evaluation of 1,274 held-out images. Each cell counts the images of one actual class given one predicted class."
      locale="en-US"
      classes={classes}
      counts={counts}
      source="Synthetic held-out split"
    />
  ),
};

function Normalized(): ReactNode {
  const [selected, setSelected] = useState<string | null>(JSON.stringify(['horse', 'dog']));
  const [cellRange, setCellRange] = useState<MatrixCellRange | null>(null);

  return (
    <Stack>
      <ConfusionMatrix
        title="Where each class goes"
        description="The same synthetic counts, each row divided by its total, so rows compare despite unequal class sizes. Select a cell to read its examples."
        locale="en-US"
        classes={classes}
        counts={counts}
        normalize="row"
        valueLabel="Images"
        selected={selected}
        onSelectedChange={setSelected}
        cellRange={cellRange}
        onCellRangeChange={setCellRange}
      />
      <p>Selected cell: {selected ?? 'none'}</p>
    </Stack>
  );
}

export const RowNormalized: Story = { render: () => <Normalized /> };

const pair = [
  { id: 'spam', label: 'spam' },
  { id: 'ham', label: 'ham' },
];

export const States: Story = {
  render: () => (
    <Stack>
      <ConfusionMatrix title="Spam filter" locale="en-US" classes={pair} counts={[]} status="loading" />
      <ConfusionMatrix title="Spam filter" locale="en-US" classes={[]} counts={[]} emptyLabel="No evaluation yet." />
      <ConfusionMatrix
        title="Spam filter, first shard"
        locale="en-US"
        classes={pair}
        counts={[
          [412, 9],
          [23, 1556],
        ]}
        coverage={{ shown: 2000, total: 48_000, unit: 'messages' }}
      />
      <ConfusionMatrix
        title="Spam filter, fractional counts"
        description="A count of 9.5 cannot come from whole examples, so the chart refuses it."
        locale="en-US"
        classes={pair}
        counts={[
          [412, 9.5],
          [23, 1556],
        ]}
      />
    </Stack>
  ),
};
