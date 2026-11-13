import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Stack } from '../../core/src/index.ts';
import { PageNavigation, PageNavigationPlaceholder } from './page-navigation.tsx';
import { Tabs } from './tabs.tsx';

const meta = {
  title: 'Navigation/Page navigation',
  component: PageNavigation,
  subcomponents: { PageNavigationPlaceholder },
  parameters: {
    docs: {
      description: {
        component:
          'PageNavigation presents application-supplied destinations and the current view. PageNavigationPlaceholder retains the same known labels and measurements without creating links. Use the actions slot for adjacent view controls. PageNavigation and Tabs share one tab geometry; links navigate and tabs switch local panels. Do not place page navigation inside a padded collection toolbar. Use the placeholder inside AsyncRegion while the destination is pending; it does not fetch, announce loading, or choose a delay.',
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

export const WithActions: Story = {
  render: () => <PageNavigation items={sections} selectedId="conversation" actions={<Button>Filter</Button>} />,
};

export const LinksAndPanels: Story = {
  render: () => (
    <Stack>
      <PageNavigation items={sections} selectedId="conversation" />
      <Tabs.Root defaultValue="conversation">
        <Tabs.List aria-label="Local panels">
          {sections.map((section) => (
            <Tabs.Tab key={section.id} value={section.id}>
              {section.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="conversation">Panel content</Tabs.Panel>
      </Tabs.Root>
    </Stack>
  ),
};
