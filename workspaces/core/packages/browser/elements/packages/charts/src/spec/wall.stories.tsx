import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Identifier, Muted, Stack, Subheading } from '../../../core/src/index.ts';
import { colors, spacing } from '../../../foundations/src/tokens.stylex.ts';
import { chartGuide } from './chart-guide.tsx';
import type { FigureFamily } from './figure-spec.ts';
import { Figure } from './figure.tsx';

const meta = {
  title: 'Charts/Wall',
  component: Figure,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Every chart in the library, drawn from its guide example through `Figure`, grouped by family. This is the consistency review surface: compare frames, axes, ticks, legends, readouts and footnotes between neighbours, in both themes and at phone width. Every example is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const CELL_MIN = 420;

const styles = stylex.create({
  page: { padding: spacing.lg },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${CELL_MIN}px), 1fr))`,
    gap: spacing.xl,
    alignItems: 'start',
  },
  cell: {
    display: 'grid',
    gap: spacing.sm,
    minWidth: 0,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  caption: { display: 'grid', gap: spacing.xs, margin: 0 },
});

const familyTitles = {
  trend: 'Trend',
  comparison: 'Comparison',
  cartesian: 'Cartesian',
  distribution: 'Distribution',
  matrix: 'Matrix',
  graph: 'Graph',
  hierarchy: 'Hierarchy',
  timeline: 'Timeline',
  relationship: 'Relationship',
  text: 'Text',
  image: 'Image',
} as const satisfies Record<FigureFamily, string>;

const families: ReadonlyArray<FigureFamily> = [
  'trend',
  'comparison',
  'cartesian',
  'distribution',
  'matrix',
  'graph',
  'hierarchy',
  'timeline',
  'relationship',
  'text',
  'image',
];

function FamilyWall({ family }: { readonly family: FigureFamily }): ReactNode {
  const entries = chartGuide.filter((entry) => entry.family === family);

  return (
    <section aria-labelledby={`wall-${family}`}>
      <Stack>
        <Subheading id={`wall-${family}`}>{familyTitles[family]}</Subheading>
        <div {...stylex.props(styles.grid)}>
          {entries.map((entry) => (
            <article key={entry.chart} {...stylex.props(styles.cell)}>
              <div {...stylex.props(styles.caption)}>
                <Identifier>{entry.chart}</Identifier>
                <Muted>{entry.question}</Muted>
              </div>
              <Figure spec={entry.example} />
            </article>
          ))}
        </div>
      </Stack>
    </section>
  );
}

function Wall({ shown }: { readonly shown: ReadonlyArray<FigureFamily> }): ReactNode {
  return (
    <div {...stylex.props(styles.page)}>
      <Stack>
        {shown.map((family) => (
          <FamilyWall key={family} family={family} />
        ))}
      </Stack>
    </div>
  );
}

function familyStory(family: FigureFamily): Story {
  return { render: () => <Wall shown={[family]} /> };
}

export const All: Story = { render: () => <Wall shown={families} /> };
export const Trend = familyStory('trend');
export const Comparison = familyStory('comparison');
export const Cartesian = familyStory('cartesian');
export const Distribution = familyStory('distribution');
export const Matrix = familyStory('matrix');
export const Graph = familyStory('graph');
export const Hierarchy = familyStory('hierarchy');
export const Timeline = familyStory('timeline');
export const Relationship = familyStory('relationship');
export const Text = familyStory('text');
export const Image = familyStory('image');
