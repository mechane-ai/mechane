import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Field } from './forms.tsx';
import { Select } from './select.tsx';
import { Stack } from './surfaces.tsx';
import { Muted } from './text.tsx';

const meta = {
  title: 'Forms/Select',
  component: Select.Root,
  subcomponents: {
    Trigger: Select.Trigger,
    Value: Select.Value,
    Icon: Select.Icon,
    Portal: Select.Portal,
    Positioner: Select.Positioner,
    Popup: Select.Popup,
    List: Select.List,
    Item: Select.Item,
    ItemText: Select.ItemText,
    ItemIndicator: Select.ItemIndicator,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Select.Root owns one choice. Trigger displays Value and Icon; Portal and Positioner place Popup, whose List contains Item, ItemText, and ItemIndicator. The application supplies options, permission filtering, and its typed onValueChange callback. Provide items so the closed value has its readable label. Use Input when people need free text. Keyboard users can open the trigger, move among options, and dismiss the popup without changing focus ownership.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const options = [
  { value: 'personal', label: 'Personal collection' },
  { value: 'engineering', label: 'Engineering and release coordination' },
  { value: 'archive', label: 'Archived collection' },
];

function CollectionSelect({
  disabled = false,
  variant = 'outline',
}: Pick<ComponentProps<typeof Select.Trigger>, 'disabled' | 'variant'>): ReactNode {
  const [value, setValue] = useState<string | null>('personal');

  return (
    <Stack compact>
      <Field.Root name="collection" disabled={disabled}>
        <Field.Label>Collection</Field.Label>
        <Select.Root<string> items={options} value={value} onValueChange={setValue} disabled={disabled}>
          <Select.Trigger variant={variant}>
            <Select.Value />
            <Select.Icon>
              <ChevronDown size={16} aria-hidden />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={4} alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.List>
                  {options.map((option) => (
                    <Select.Item key={option.value} value={option.value} disabled={option.value === 'archive'}>
                      <Select.ItemText>{option.label}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={16} aria-hidden />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Field.Description>Archived collections are unavailable for new items.</Field.Description>
      </Field.Root>
      <Muted>Selected value: {value ?? 'None'}</Muted>
    </Stack>
  );
}

export const Recommended: Story = { render: () => <CollectionSelect /> };
export const GhostTrigger: Story = { render: () => <CollectionSelect variant="ghost" /> };
export const Disabled: Story = { render: () => <CollectionSelect disabled /> };

export const NarrowPopup: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <CollectionSelect />,
};
