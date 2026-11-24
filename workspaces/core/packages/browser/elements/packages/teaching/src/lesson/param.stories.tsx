import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { defineLesson } from './define-lesson.ts';
import { Lesson } from './lesson.tsx';
import { ParamChoice, ParamSlider, ParamToggle } from './param-controls.tsx';
import { Param, Value } from './param.tsx';

const meta = {
  title: 'Teaching/Param',
  component: Param,
  subcomponents: { Value, ParamSlider, ParamChoice, ParamToggle },
  parameters: {
    docs: {
      description: {
        component:
          'Param puts a lesson value inside a sentence: a number the reader drags or steps, an option picked from a short list, or a switch. Value writes a param or derived value in its declared format and tells a screen reader once it rests. ParamSlider, ParamChoice and ParamToggle are the labelled block controls for a figure’s footer; the author supplies only the name.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** How much smaller the first steps are while warm-up runs. */
const WARMUP_SHARE = 0.1;

/** Synthetic: how far each optimizer moves the weights per unit of learning rate on the first step. */
const optimizerScale = { sgd: 1, adam: 3.2, lion: 4.5 } as const;

const optimizer = defineLesson({
  id: 'first-step',
  title: 'How big is the first update?',
  params: {
    learningRate: {
      kind: 'number',
      label: 'Learning rate',
      value: 0.0003,
      min: 0.00001,
      max: 0.1,
      step: 0.00001,
      scale: 'log',
      format: { maximumSignificantDigits: 2 },
    },
    optimizer: {
      kind: 'choice',
      label: 'Optimizer',
      value: 'adam',
      options: [
        { id: 'sgd', label: 'SGD' },
        { id: 'adam', label: 'Adam' },
        { id: 'lion', label: 'Lion' },
      ],
    },
    hasWarmup: { kind: 'toggle', label: 'Warm-up', value: true },
    batchSize: {
      kind: 'number',
      label: 'Batch size',
      value: 64,
      min: 8,
      max: 512,
      step: 8,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    updateSize: {
      label: 'First update size',
      format: { notation: 'scientific', maximumFractionDigits: 1 },
      from: (values) => values.learningRate * optimizerScale[values.optimizer] * (values.hasWarmup ? WARMUP_SHARE : 1),
    },
    noise: {
      label: 'Gradient noise',
      format: { style: 'percent', maximumFractionDigits: 0 },
      from: (values) => 1 / Math.sqrt(values.batchSize),
    },
  },
});

const styles = stylex.create({
  page: { display: 'grid', gap: spacing.xl, maxWidth: 720, minWidth: 0, color: colors.ink },
  prose: {
    margin: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
  },
  footer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
    alignItems: 'start',
    gap: spacing.lg,
  },
});

function Sentence(): ReactNode {
  return (
    <p {...stylex.props(styles.prose)}>
      Synthetic numbers. Train with <Param name="optimizer" /> at a learning rate of <Param name="learningRate" /> and a
      batch of <Param name="batchSize" /> sequences, with warm-up <Param name="hasWarmup" />. The first update moves
      each weight by about <Value name="updateSize" />, and the gradient carries <Value name="noise" /> noise. Warm-up
      is <Value name="hasWarmup" labels={{ on: 'on', off: 'off' }} />.
    </p>
  );
}

function Controls(): ReactNode {
  return (
    <div {...stylex.props(styles.footer)}>
      <ParamSlider name="learningRate" />
      <ParamSlider name="batchSize" />
      <ParamChoice name="optimizer" />
      <ParamToggle name="hasWarmup" />
    </div>
  );
}

export const InProse: Story = {
  render: () => (
    <Lesson lesson={optimizer} locale="en-US">
      <div {...stylex.props(styles.page)}>
        <Sentence />
        <Controls />
      </div>
    </Lesson>
  ),
};

export const BlockControls: Story = {
  render: () => (
    <Lesson lesson={optimizer} locale="en-US">
      <div {...stylex.props(styles.page)}>
        <Controls />
        <p {...stylex.props(styles.prose)}>
          First update: <Value name="updateSize" />. Noise: <Value name="noise" />.
        </p>
      </div>
    </Lesson>
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <Lesson lesson={optimizer} locale="en-US" values={{ optimizer: 'lion', hasWarmup: false }} isReadOnly>
      <div {...stylex.props(styles.page)}>
        <Sentence />
        <Controls />
      </div>
    </Lesson>
  ),
};

export const Errors: Story = {
  render: () => (
    <Lesson lesson={optimizer} locale="en-US">
      <div {...stylex.props(styles.page)}>
        <p {...stylex.props(styles.prose)}>
          An unknown param: <Param name="momentum" /> An unknown value: <Value name="loss" />
        </p>
        <ParamChoice name="learningRate" />
        <ParamToggle name="optimizer" />
      </div>
    </Lesson>
  ),
};
