import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Text, TextLink } from '../../core/src/index.ts';
import { Breadcrumb, Kbd } from './navigation.tsx';

const meta = {
  title: 'Navigation/Breadcrumb',
  component: Breadcrumb.Root,
  subcomponents: {
    List: Breadcrumb.List,
    Item: Breadcrumb.Item,
    Separator: Breadcrumb.Separator,
    Current: Breadcrumb.Current,
    Kbd,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Breadcrumb describes the current location; application-owned links supply navigation. Current marks the page and is not a duplicate link. Use Tabs for parallel views and the sidebar for primary navigation. Kbd displays an application-declared key combination; it registers no listener and makes no claim that the command is available. A keyboard hint supplements the visible action.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Location: Story = {
  render: () => (
    <Stack>
      <Breadcrumb.Root aria-label="Breadcrumb">
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <TextLink href="#projects">Projects</TextLink>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <TextLink href="#sample">Sample project</TextLink>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Current>Evaluation detail</Breadcrumb.Current>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
      <Text>
        Open commands <Kbd>⌘ K</Kbd>
      </Text>
    </Stack>
  ),
};
