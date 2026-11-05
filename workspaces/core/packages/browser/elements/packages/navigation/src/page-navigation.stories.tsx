import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../../core/src/index.ts';
import { PageNavigation, PageNavigationPlaceholder } from './page-navigation.tsx';

const meta = {
  title: 'Navigation/Page navigation',
  component: PageNavigation,
  subcomponents: { PageNavigationPlaceholder },
  parameters: {
    docs: {
      description: {
        component:
          'PageNavigation presents application-supplied destinations and the current view. PageNavigationPlaceholder retains the same known labels and measurements without creating links. Use the placeholder inside AsyncRegion while the destination is pending; it does not fetch, announce loading, or choose a delay.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const sections = [
  { id: 'conversation', label: 'Conversation', href: '#conversation' },
  { id: 'work', label: 'Work', href: '#work' },
  { id: 'runs', label: 'Runs', href: '#runs' },
];

export const PendingAndReady: Story = {
  render: () => (
    <Stack>
      <PageNavigationPlaceholder items={sections} />
      <PageNavigation items={sections} selectedId="conversation" />
    </Stack>
  ),
};
