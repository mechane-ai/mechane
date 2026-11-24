import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { CurveChart } from '../../packages/charts/src/trend/curve-chart.tsx';
import { spacing } from '../../packages/foundations/src/tokens.stylex.ts';
import { defineLesson } from '../../packages/teaching/src/lesson/define-lesson.ts';
import { useLesson } from '../../packages/teaching/src/lesson/use-lesson.ts';

const POINTS = 41;
const INPUT_MAX = 4;

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

/** One synthetic neuron: a weighted input plus a bias, through a sigmoid. The stories of the exercises share it. */
export const neuronLesson = defineLesson({
  id: 'neuron',
  title: 'One neuron',
  params: {
    weight: {
      kind: 'number',
      label: 'Weight',
      value: 0.5,
      min: -2,
      max: 2,
      step: 0.1,
      format: { maximumFractionDigits: 1 },
    },
    bias: { kind: 'number', label: 'Bias', value: 0, min: -3, max: 3, step: 0.1, format: { maximumFractionDigits: 1 } },
  },
  derived: {
    output: {
      label: 'Output at input 1',
      format: { maximumFractionDigits: 2 },
      from: (values) => sigmoid(values.weight + values.bias),
    },
  },
  beats: [
    {
      id: 'neuron',
      title: 'A weight and a bias',
      states: [
        { id: 'flat', label: 'Weight −1', values: { weight: -1, bias: 0 } },
        { id: 'gentle', label: 'Weight 0.5', values: { weight: 0.5, bias: 0 } },
        { id: 'steep', label: 'Weight 2', values: { weight: 2, bias: 0 } },
      ],
    },
  ],
});

const inputs = Array.from({ length: POINTS }, (_, index) => -INPUT_MAX + (2 * INPUT_MAX * index) / (POINTS - 1));

/** The neuron's output across inputs, with input 1 marked. */
export function NeuronCurve(): ReactNode {
  const { values, locale } = useLesson(neuronLesson);

  return (
    <CurveChart
      title="Output by input"
      description="The sigmoid of weight times input plus bias, for synthetic inputs from −4 to 4."
      locale={locale}
      series={[
        {
          id: 'output',
          label: 'Output',
          tone: 'series2',
          points: inputs.map((input) => ({ x: input, y: sigmoid(values.weight * input + values.bias) })),
        },
      ]}
      x={{ label: 'Input', domain: [-INPUT_MAX, INPUT_MAX], format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Output', domain: [0, 1], format: { maximumFractionDigits: 1 } }}
      markers={[{ x: 1, label: 'Input 1' }]}
      labels="none"
      height="compact"
    />
  );
}

const styles = stylex.create({ page: { paddingBlock: spacing.xl, paddingInline: spacing.lg } });

/** The padding every exercise story puts around its article. */
export function StoryPage({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.page)}>{children}</div>;
}
