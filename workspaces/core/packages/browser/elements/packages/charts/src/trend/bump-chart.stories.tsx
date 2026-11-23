import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import { BumpChart } from './bump-chart.tsx';
import type { BumpItem, BumpStage } from './bump-chart.tsx';

const meta = {
  title: 'Charts/BumpChart',
  component: BumpChart,
  parameters: {
    docs: {
      description: {
        component:
          'Rank over ordered stages, such as a model leaderboard by month. Rank 1 is at the top, each item is one line, and inspecting an item makes the others recede. The application supplies whole-number ranks with one item per rank at each stage; duplicate ranks and fractions are refused. An item with no rank at a stage leaves a gap in its line. The data here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const months: ReadonlyArray<BumpStage> = [
  { id: 'jan', label: 'Jan' },
  { id: 'feb', label: 'Feb' },
  { id: 'mar', label: 'Mar' },
  { id: 'apr', label: 'Apr' },
  { id: 'may', label: 'May' },
  { id: 'jun', label: 'Jun' },
];

const leaderboard: ReadonlyArray<BumpItem> = [
  { id: 'atlas', label: 'Atlas-7B', ranks: [1, 1, 2, 3, 3, 4] },
  { id: 'borealis', label: 'Borealis-13B', ranks: [2, 3, 1, 1, 2, 2] },
  { id: 'cinder', label: 'Cinder-3B', ranks: [5, 4, 4, 5, 6, 7] },
  { id: 'delta', label: 'Delta-34B', ranks: [3, 2, 3, 2, 1, 1] },
  { id: 'ember', label: 'Ember-8B', ranks: [4, 5, 6, 4, 4, 3] },
  { id: 'fjord', label: 'Fjord-1B', ranks: [7, 7, 7, 7, 7, 6] },
  { id: 'gale', label: 'Gale-20B', ranks: [6, 6, 5, 6, 5, 5] },
];

export const LeaderboardByMonth: Story = {
  render: () => (
    <BumpChart
      title="Model leaderboard by month"
      description="Synthetic ranks on a fixed evaluation suite. Point at a model to follow its path."
      locale="en-US"
      stages={months}
      items={leaderboard}
      source="Synthetic leaderboard"
    />
  ),
};

const entrants: ReadonlyArray<BumpItem> = leaderboard.map((item) =>
  item.id === 'fjord' ? { ...item, ranks: [null, null, null, 7, 7, 6] } : item,
);

export const JoiningModel: Story = {
  render: () => (
    <BumpChart
      title="A model joins in April"
      description="Fjord-1B was not ranked before April, so its line starts there."
      locale="en-US"
      stages={months}
      items={entrants.filter((item) => item.id !== 'cinder')}
      height="compact"
    />
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <BumpChart title="Loading" locale="en-US" status="loading" stages={months} items={[]} height="compact" />
      <BumpChart title="Empty" locale="en-US" stages={months} items={[]} height="compact" />
      <BumpChart
        title="Partial"
        locale="en-US"
        coverage={{ shown: 7, total: 212, unit: 'models' }}
        stages={months}
        items={leaderboard}
        height="compact"
      />
      <BumpChart
        title="Invalid"
        locale="en-US"
        stages={months}
        items={[
          { id: 'one', label: 'One', ranks: [1, 1, 1, 1, 1, 1] },
          { id: 'two', label: 'Two', ranks: [1, 2, 2, 2, 2, 2] },
        ]}
        height="compact"
      />
    </ChartGrid>
  ),
};
