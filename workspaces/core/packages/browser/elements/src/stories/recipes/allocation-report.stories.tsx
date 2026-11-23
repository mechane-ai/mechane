import type { Meta, StoryObj } from '@storybook/react-vite';
import { AllocationReport } from '../../../recipes/allocation-report.tsx';

const meta = {
  title: 'Recipes/Allocation Report',
  component: AllocationReport,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AllocationReport>;

export default meta;

const commitments = [
  { id: 'housing', label: 'Housing', amount: 1850, tone: 'series3' },
  {
    id: 'spending',
    label: 'Spending',
    amount: 2400,
    tone: 'series4',
    parts: [
      { id: 'groceries', label: 'Groceries', amount: 820 },
      { id: 'transport', label: 'Transport', amount: 460 },
      { id: 'other', label: 'Everything else', amount: 1120 },
    ],
  },
] as const;

export const Example: StoryObj<typeof meta> = {
  args: {
    title: 'Monthly plan',
    headline: 'After housing and spending, $1,950 a month is left to save, $550 short of the goal.',
    totalLabel: 'Income after tax',
    total: 6200,
    commitments,
    remainderLabel: 'Left to save',
    target: { id: 'goal', label: 'Saving goal', value: 2500, tone: 'positive' },
    explanation: 'bridge',
    valueFormat: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
    locale: 'en-US',
  },
};

export const DividedCommitments: StoryObj<typeof meta> = {
  args: {
    ...Example.args,
    headline: 'Spending divides into three categories; groceries is the largest.',
    explanation: 'flow',
  },
};
