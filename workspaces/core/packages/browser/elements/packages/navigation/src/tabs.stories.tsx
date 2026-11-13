import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { Muted } from '../../core/src/index.ts';
import { ContentTabs } from './content-tabs.tsx';
import { Tabs } from './tabs.tsx';

const meta = {
  title: 'Controls/Tabs',
  component: Tabs.Root,
  subcomponents: { List: Tabs.List, Tab: Tabs.Tab, Panel: Tabs.Panel, ContentTabs },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Tabs.Root owns the current value, List names the choices, and each Tab selects the matching Panel. ContentTabs mounts one selected view and accepts defaultSelectedId for an initial local choice. Use its navigation mode for application-controlled URLs; it cannot be combined with defaultSelectedId. The application supplies stable values, content and route synchronization. Arrow keys move among available tabs. Disabled tabs communicate unavailable views without changing the current selection.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ExampleTabs({ orientation = 'horizontal' }: Pick<ComponentProps<typeof Tabs.Root>, 'orientation'>) {
  return (
    <Tabs.Root defaultValue="summary" orientation={orientation}>
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
  );
}

export const Recommended: Story = { render: () => <ExampleTabs /> };

export const NarrowTabs: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };

export const VerticalTabs: Story = { render: () => <ExampleTabs orientation="vertical" /> };

export const InitialSection: Story = {
  render: () => (
    <ContentTabs
      label="Item sections"
      defaultSelectedId="history"
      items={[
        { id: 'summary', label: 'Summary', content: <Muted>The summary of the selected item.</Muted> },
        { id: 'history', label: 'History', content: <Muted>No changes have been recorded yet.</Muted> },
      ]}
    />
  ),
};
