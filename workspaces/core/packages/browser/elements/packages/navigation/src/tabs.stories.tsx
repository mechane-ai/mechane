import type { Meta, StoryObj } from '@storybook/react-vite';
import { Muted } from '../../core/src/index.ts';
import { Tabs } from './tabs.tsx';

const meta = {
  title: 'Controls/Tabs',
  component: Tabs.Root,
  subcomponents: { List: Tabs.List, Tab: Tabs.Tab, Panel: Tabs.Panel },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Tabs.Root owns the current value, List names the choices, and each Tab selects the matching Panel. Use tabs for peer views of the same resource; use navigation links for another resource. The application supplies stable values, content, and route synchronization when the selection belongs in a URL. Arrow keys move among available tabs. Disabled tabs communicate unavailable views without changing the current selection.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Tabs.Root defaultValue="summary">
      <Tabs.List aria-label="Item details">
        <Tabs.Tab value="summary">Summary</Tabs.Tab>
        <Tabs.Tab value="history">Change history</Tabs.Tab>
        <Tabs.Tab value="attachments" disabled>
          Attachments
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="summary">
        <Muted>The summary of the selected item.</Muted>
      </Tabs.Panel>
      <Tabs.Panel value="history">
        <Muted>No changes have been recorded yet.</Muted>
      </Tabs.Panel>
      <Tabs.Panel value="attachments">
        <Muted>Attachments are unavailable.</Muted>
      </Tabs.Panel>
    </Tabs.Root>
  ),
};

export const NarrowTabs: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };
