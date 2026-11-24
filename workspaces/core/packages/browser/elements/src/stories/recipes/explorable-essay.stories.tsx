import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExplorableEssay } from '../../../recipes/explorable-essay.tsx';

const meta = {
  title: 'Recipes/Explorable Essay',
  component: ExplorableEssay,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ExplorableEssay>;

export default meta;

export const Example: StoryObj<typeof meta> = {
  args: {
    title: 'Why a bigger batch is quieter',
    summary:
      'The gradient of a batch is an average. See how its noise falls as the batch grows, with synthetic numbers.',
  },
};
