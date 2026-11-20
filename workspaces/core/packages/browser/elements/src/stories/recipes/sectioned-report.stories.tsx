import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionedReport } from '../../../recipes/sectioned-report.tsx';

const meta = {
  title: 'Recipes/Sectioned Report',
  component: SectionedReport,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SectionedReport>;

export default meta;

const contributors = Array.from({ length: 32 }, (_, index) => ({
  id: String(index),
  name: `Work item ${index + 1}`,
  team: index % 2 === 0 ? 'Operations' : 'Design',
}));

export const Example: StoryObj<typeof meta> = {
  args: {
    sections: [
      { id: 'outcomes', title: 'Outcomes', metric: { label: 'Recorded items', value: '32' }, contributors },
      {
        id: 'age',
        title: 'Unresolved age',
        metric: { label: 'Median age', value: '4 days' },
        contributors: contributors.slice(0, 16),
      },
    ],
  },
};
