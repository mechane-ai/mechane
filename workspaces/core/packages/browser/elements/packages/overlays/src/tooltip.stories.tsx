import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCw } from 'lucide-react';
import { IconButton } from '../../core/src/index.ts';
import { Tooltip } from './tooltip.tsx';

const meta = {
  title: 'Overlays/Tooltip',
  component: Tooltip.Root,
  subcomponents: {
    Provider: Tooltip.Provider,
    Trigger: Tooltip.Trigger,
    Portal: Tooltip.Portal,
    Positioner: Tooltip.Positioner,
    Popup: Tooltip.Popup,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Tooltip.Provider shares timing across nearby Tooltip.Root instances. Trigger composes the named control; Portal and Positioner place the supplemental Popup. The application supplies concise help and the control’s independent accessible name. Use visible text for essential instructions and a Dialog for interactive content. Focus or hover the example to reveal its help; the tooltip never supplies the button’s only name.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<IconButton aria-label="Refresh items" />}>
          <RefreshCw size={16} aria-hidden />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={8}>
            <Tooltip.Popup>Load the latest items</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  ),
};
