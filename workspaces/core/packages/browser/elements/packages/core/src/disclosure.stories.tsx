import type { Meta, StoryObj } from '@storybook/react-vite';
import { Accordion, Collapsible } from './disclosure.tsx';
import { Stack } from './surfaces.tsx';
import { Muted } from './text.tsx';

const meta = {
  title: 'Controls/Disclosure',
  component: Accordion.Root,
  subcomponents: {
    Item: Accordion.Item,
    Header: Accordion.Header,
    Trigger: Accordion.Trigger,
    Panel: Accordion.Panel,
    Collapsible: Collapsible.Root,
    CollapsibleTrigger: Collapsible.Trigger,
    CollapsiblePanel: Collapsible.Panel,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Accordion groups related disclosures; Collapsible owns one optional region. Use Tabs for parallel views when only one should remain visible. Base UI owns open state, accessibility attributes and hidden content. Supply value and onValueChange together for a controlled Accordion, or defaultValue for local state. Collapsible follows the same open/defaultOpen rule. Content is already available; disclosure does not imply a resource read.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Grouped: Story = {
  render: () => (
    <Accordion.Root defaultValue={['summary']} multiple>
      <Accordion.Item value="summary">
        <Accordion.Header>
          <Accordion.Trigger>Summary</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>The operation completed with the recorded inputs.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="metadata">
        <Accordion.Header>
          <Accordion.Trigger>Metadata</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Created November 3, 2026. Labels and timestamps come from the application.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="restricted" disabled>
        <Accordion.Header>
          <Accordion.Trigger>Restricted details</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Unavailable content.</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
};

export const Single: Story = {
  render: () => (
    <Stack>
      <Muted>The main result stays visible.</Muted>
      <Collapsible.Root>
        <Collapsible.Trigger>Supporting details</Collapsible.Trigger>
        <Collapsible.Panel>This detail is optional and receives no independent loading state.</Collapsible.Panel>
      </Collapsible.Root>
    </Stack>
  ),
};
