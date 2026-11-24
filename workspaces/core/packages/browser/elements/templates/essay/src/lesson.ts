import { defineLesson } from '@mechane-ai/elements/lesson';

/** The number of steps the loss curve draws. */
export const LAST_STEP = 10;

/** The slope of the loss w² is this multiple of the weight. */
const SLOPE = 2;

/**
 * Gradient descent on the loss w². One step moves the weight against its slope 2w by a fraction `rate`, so the weight
 * is multiplied by 1 − 2 × rate each step. The numbers are synthetic.
 */
export const lesson = defineLesson({
  id: 'learning-rate',
  title: 'Why a big learning rate blows up',
  params: {
    rate: {
      kind: 'number',
      label: 'Learning rate',
      value: 0.1,
      min: 0.05,
      max: 1.2,
      step: 0.05,
      format: { maximumFractionDigits: 2 },
    },
    steps: {
      kind: 'number',
      label: 'Steps taken',
      value: 0,
      min: 0,
      max: LAST_STEP,
      step: 1,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    weight: {
      label: 'Weight',
      format: { maximumSignificantDigits: 3 },
      from: ({ rate, steps }) => (1 - SLOPE * rate) ** steps,
    },
    loss: { label: 'Loss', format: { maximumSignificantDigits: 2 }, from: ({ weight }) => weight * weight },
    factor: {
      label: 'Loss factor per step',
      format: { maximumFractionDigits: 2 },
      from: ({ rate }) => (1 - SLOPE * rate) ** SLOPE,
    },
  },
  beats: [
    {
      id: 'update',
      title: 'One step of gradient descent',
      goal: 'See that a step moves the weight against its slope by a fixed fraction of that slope.',
      misconception: 'That a bigger step always gets to the minimum sooner.',
      states: [
        { id: 'start', label: 'Before the first step', values: { rate: 0.1, steps: 0 } },
        { id: 'one-step', label: 'After one step', values: { rate: 0.1, steps: 1 } },
      ],
    },
    {
      id: 'rate',
      title: 'The rate sets how fast the loss falls',
      goal: 'Connect a larger rate with a smaller loss factor, up to the rate that lands on the minimum.',
      hints: ['Press play, then raise the rate to 0.4 and play again.', 'At 0.5 the very first step lands on zero.'],
      states: [
        { id: 'slow', label: 'Rate 0.1, ten steps', values: { rate: 0.1, steps: LAST_STEP } },
        { id: 'fast', label: 'Rate 0.4, ten steps', values: { rate: 0.4, steps: LAST_STEP } },
        { id: 'exact', label: 'Rate 0.5, ten steps', values: { rate: 0.5, steps: LAST_STEP } },
      ],
    },
    {
      id: 'blowup',
      title: 'Past a rate of one, the loss grows',
      goal: 'Find the rate where each step stops shrinking the loss and starts growing it.',
      misconception: 'That the loss only grows once the rate is far above the best one.',
      hints: ['The factor per step is exactly 1 at a rate of 1.', 'Look at the loss factor, not the weight.'],
      states: [
        { id: 'edge', label: 'Rate 1, ten steps', values: { rate: 1, steps: LAST_STEP } },
        { id: 'blown', label: 'Rate 1.1, ten steps', values: { rate: 1.1, steps: LAST_STEP } },
      ],
    },
  ],
});
