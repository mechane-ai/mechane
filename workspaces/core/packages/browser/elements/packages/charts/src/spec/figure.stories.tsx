import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Muted, Prose, Stack } from '../../../core/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { chartGuide } from './chart-guide.tsx';
import type { FigureSpec } from './figure-spec.ts';
import { describeFigure } from './figure-text.ts';
import { Figure } from './figure.tsx';

const meta = {
  title: 'Charts/Figure',
  component: Figure,
  parameters: {
    docs: {
      description: {
        component:
          'Draws any chart from a figure spec: plain JSON that names the chart and its props, so an agent or a server can emit it, `validateFigureSpec` can check it and `describeFigure` can read it back as text. Selection and other state JSON cannot carry are passed beside the spec. Every example is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const CELL_MIN = 360;

const styles = stylex.create({
  split: {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${CELL_MIN}px), 1fr))`,
    gap: spacing.xl,
    alignItems: 'start',
  },
  code: { margin: 0, maxHeight: 480, overflow: 'auto' },
});

const latency: FigureSpec = {
  chart: 'DumbbellPlot',
  props: {
    title: 'p95 latency before and after the cache',
    description: 'Synthetic medians per endpoint.',
    locale: 'en-US',
    rows: [
      { id: 'chat', label: 'Chat', from: 820, to: 610 },
      { id: 'search', label: 'Search', from: 540, to: 430 },
      { id: 'embed', label: 'Embeddings', from: 160, to: 150 },
    ],
    fromLabel: 'Before',
    toLabel: 'After',
    value: { label: 'p95 latency (ms)', domain: [0, 1000], format: { maximumFractionDigits: 0 } },
    source: 'Synthetic gateway metrics',
  },
};

function JsonBeside({ spec }: { readonly spec: FigureSpec }): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div {...stylex.props(styles.split)}>
      <Prose {...stylex.props(styles.code)}>{JSON.stringify(spec, null, 2)}</Prose>
      <Stack>
        <Figure spec={spec} selected={selected} onSelectedChange={(id) => setSelected(id)} />
        <Muted>Selected: {selected ?? 'nothing'}</Muted>
      </Stack>
    </div>
  );
}

export const JsonSpec: Story = { render: () => <JsonBeside spec={latency} /> };

const invalidSpecs: ReadonlyArray<{ readonly id: string; readonly spec: unknown }> = [
  { id: 'unknown', spec: { chart: 'Histogramm', props: { title: 'Response length', locale: 'en-US' } } },
  {
    id: 'missing',
    spec: { chart: 'CurveChart', props: { title: 'Validation loss', locale: 'en-US', x: { label: 'Step' } } },
  },
  {
    id: 'function',
    spec: {
      chart: 'Treemap',
      props: { title: 'GPU hours', locale: 'en-US', items: [], valueFormat: { format: () => 'x' } },
    },
  },
];

export const InvalidSpec: Story = {
  render: () => (
    <Stack>
      {invalidSpecs.map(({ id, spec }) => (
        <Figure key={id} spec={spec} />
      ))}
    </Stack>
  ),
};

const describedCharts: ReadonlySet<string> = new Set(['CurveChart', 'BoxPlot', 'Matrix', 'EmbeddingMap']);
const described = chartGuide.filter((entry) => describedCharts.has(entry.chart));

export const DescribedAsText: Story = {
  render: () => (
    <Stack>
      {described.map((entry) => (
        <Prose key={entry.chart}>{describeFigure(entry.example)}</Prose>
      ))}
    </Stack>
  ),
};
