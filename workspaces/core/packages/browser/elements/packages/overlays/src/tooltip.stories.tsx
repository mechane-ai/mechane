import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCw } from 'lucide-react';
import { IconButton } from '../../core/src/index.ts';
import { Tooltip } from './tooltip.tsx';

const meta = {
  title: 'Overlays/Tooltip',
  component: Tooltip.Root,
  subcomponents: { Trigger: Tooltip.Trigger, Popup: Tooltip.Popup },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Tooltip.Root connects the named Trigger to its Popup. Popup handles portal placement and positioning. The application supplies concise help and the control’s independent accessible name. Use visible text for essential instructions and a Dialog for interactive content. Focus or hover the example to reveal its help; the tooltip never supplies the button’s only name.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Tooltip.Root>
      <Tooltip.Trigger render={<IconButton aria-label="Refresh items" />}>
        <RefreshCw size={16} aria-hidden />
      </Tooltip.Trigger>
      <Tooltip.Popup sideOffset={8}>Load the latest items</Tooltip.Popup>
    </Tooltip.Root>
  ),
};
