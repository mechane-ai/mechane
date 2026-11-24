import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { BoundValue } from './bound-value.tsx';

const meta = {
  title: 'Teaching/BoundValue',
  component: BoundValue,
  parameters: {
    docs: {
      description: {
        component:
          'BoundValue is a number in a sentence the reader changes in place: drag it sideways, or focus it and use the arrow keys, Page Up, Page Down, Home and End. Inside a lesson, use Param, which binds one to a lesson param; use BoundValue alone when the application holds the number. The application supplies the bounds, the step, the format and the label.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({
  text: {
    margin: 0,
    maxWidth: '64ch',
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
  },
  stack: { display: 'grid', gap: spacing.lg },
});

/** Synthetic: the tokens a run sees, from its batch size and its step count. */
function WarmupSentence(): ReactNode {
  const [steps, setSteps] = useState(2000);
  const [rate, setRate] = useState(0.0003);

  return (
    <div {...stylex.props(styles.stack)}>
      <p {...stylex.props(styles.text)}>
        Warm up for{' '}
        <BoundValue
          value={steps}
          onValueChange={setSteps}
          min={0}
          max={10_000}
          step={100}
          locale="en-US"
          format={{ maximumFractionDigits: 0 }}
          label="Warm-up steps"
        />{' '}
        steps to a peak learning rate of{' '}
        <BoundValue
          value={rate}
          onValueChange={setRate}
          min={0.00001}
          max={0.01}
          step={0.00001}
          scale="log"
          locale="en-US"
          format={{ maximumSignificantDigits: 2 }}
          label="Peak learning rate"
        />
        . Drag a number sideways, or focus it and press the arrow keys.
      </p>
    </div>
  );
}

export const Default: Story = { render: () => <WarmupSentence /> };

export const Uncontrolled: Story = {
  render: () => (
    <p {...stylex.props(styles.text)}>
      Sample at a temperature of{' '}
      <BoundValue
        defaultValue={0.7}
        min={0}
        max={2}
        step={0.05}
        locale="en-US"
        format={{ maximumFractionDigits: 2 }}
        label="Sampling temperature"
      />
      .
    </p>
  ),
};

export const Invalid: Story = {
  render: () => (
    <p {...stylex.props(styles.text)}>
      Bounds the wrong way round:{' '}
      <BoundValue
        defaultValue={1}
        min={4}
        max={1}
        step={1}
        locale="en-US"
        format={{ maximumFractionDigits: 0 }}
        label="Layer"
      />
      .
    </p>
  ),
};
