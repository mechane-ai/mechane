import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './actions.tsx';
import { Menu } from './menu.tsx';
import { Stack } from './surfaces.tsx';
import { Muted } from './text.tsx';

const meta = {
  title: 'Overlays/Menu',
  component: Menu.Root,
  subcomponents: {
    Trigger: Menu.Trigger,
    Portal: Menu.Portal,
    Positioner: Menu.Positioner,
    Popup: Menu.Popup,
    Item: Menu.Item,
    LinkItem: Menu.LinkItem,
    Group: Menu.Group,
    GroupLabel: Menu.GroupLabel,
    Separator: Menu.Separator,
    CheckboxItem: Menu.CheckboxItem,
    RadioGroup: Menu.RadioGroup,
    RadioItem: Menu.RadioItem,
    SubmenuRoot: Menu.SubmenuRoot,
    SubmenuTrigger: Menu.SubmenuTrigger,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Menu groups actions and immediate settings. Use Select or Combobox for a submitted form value. Item reports an action; LinkItem preserves navigation semantics. CheckboxItem and RadioGroup receive controlled values and callbacks. Base UI owns keyboard navigation, typeahead, dismissal and focus return. The application supplies command eligibility and destinations. Compose the Trigger with Button through render.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function MenuExample(): ReactNode {
  const [showDetails, setShowDetails] = useState(true);
  const [density, setDensity] = useState('compact');
  const [action, setAction] = useState('No action selected');

  return (
    <Stack compact>
      <Menu.Root>
        <Menu.Trigger render={<Button />}>View options</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start">
            <Menu.Popup>
              <Menu.Group>
                <Menu.GroupLabel>Current view</Menu.GroupLabel>
                <Menu.Item onClick={() => setAction('Refresh requested')}>Refresh</Menu.Item>
                <Menu.LinkItem href="#menu-docs">View documentation</Menu.LinkItem>
                <Menu.Item disabled>Export unavailable</Menu.Item>
              </Menu.Group>
              <Menu.Separator />
              <Menu.CheckboxItem checked={showDetails} onCheckedChange={setShowDetails}>
                Show details
              </Menu.CheckboxItem>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>
                  Density <ChevronRight size={14} aria-hidden />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.RadioGroup value={density} onValueChange={setDensity}>
                        <Menu.RadioItem value="compact">Compact</Menu.RadioItem>
                        <Menu.RadioItem value="comfortable">Comfortable</Menu.RadioItem>
                      </Menu.RadioGroup>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Muted>
        {action}. Density: {density}. Details {showDetails ? 'shown' : 'hidden'}.
      </Muted>
    </Stack>
  );
}

export const ActionsAndChoices: Story = { render: () => <MenuExample /> };
