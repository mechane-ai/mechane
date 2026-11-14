import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Button, Muted, Stack } from '../../core/src/index.ts';
import { Field } from './forms.tsx';
import { SelectControl } from './select-control.tsx';
import { Select } from './select.tsx';

const meta = {
  title: 'Forms/Select',
  component: SelectControl,
  subcomponents: {
    Root: Select.Root,
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
          'Use SelectControl for one choice from labeled string values. It composes Select with the standard trigger icons, option list and popup. Supply items once, a controlled value and onValueChange; readOnly=true can omit the callback. label names the trigger without adding a visible label row, and an enclosing Field supplies form descriptions and errors. name, form, required and inputRef connect the hidden form input; ref and native events belong to the trigger. Disabled options remain visible and cannot be selected. Use compound Select for object or multiple values, custom trigger content or rich option layouts; use Combobox when choices need search. Standard density is the default; compact changes the trigger while popup options stay standard. Selection stays supplied when options change, and opening or focusing never chooses a value.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const options = [
  { value: 'personal', label: 'Personal collection' },
  { value: 'engineering', label: 'Engineering and release coordination' },
  { value: 'archive', label: 'Archived collection', disabled: true },
];

function CollectionSelect({
  disabled = false,
  variant = 'outline',
  density = 'standard',
}: Pick<ComponentProps<typeof SelectControl<string>>, 'disabled' | 'variant' | 'density'>): ReactNode {
  const [value, setValue] = useState<string | null>('personal');

  return (
    <Stack isCompact>
      <Field.Root name="collection" disabled={disabled}>
        <Field.Label>Collection</Field.Label>
        <SelectControl
          label="Collection"
          name="collection"
          items={options}
          value={value}
          onValueChange={setValue}
          disabled={disabled}
          variant={variant}
          density={density}
        />
        <Field.Description>Archived collections are unavailable for new items.</Field.Description>
      </Field.Root>
      <Muted>Selected value: {value ?? 'None'}</Muted>
    </Stack>
  );
}

function ComposedSelect(): ReactNode {
  const [value, setValue] = useState<string | null>('personal');

  return (
    <Select.Root<string> items={options} value={value} onValueChange={setValue}>
      <Select.Trigger aria-label="Collection" density="compact" render={<Button density="compact" />}>
        Open <Select.Value />
        <Select.Icon>
          <ChevronDown size={16} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner align="end">
          <Select.Popup>
            <Select.List>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} disabled={option.disabled}>
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
  );
}

function UnselectedSelect(): ReactNode {
  const [value, setValue] = useState<string | null>(null);

  return (
    <SelectControl
      label="Collection"
      items={options}
      value={value}
      onValueChange={setValue}
      placeholder="Choose a collection"
    />
  );
}

function ChangingOptions(): ReactNode {
  const [value, setValue] = useState<string | null>('personal');
  const [isEngineeringAvailable, setEngineeringAvailable] = useState(true);
  const [changes, setChanges] = useState(0);
  const items = options.filter((option) => isEngineeringAvailable || option.value !== 'engineering');

  return (
    <Stack isCompact>
      <SelectControl
        label="Collection"
        items={items}
        value={value}
        onValueChange={(nextValue) => {
          setValue(nextValue);
          setChanges((count) => count + 1);
        }}
      />
      <Button onClick={() => setEngineeringAvailable((available) => !available)}>
        {isEngineeringAvailable ? 'Remove engineering option' : 'Restore engineering option'}
      </Button>
      <Muted>
        Selected: {value ?? 'None'} · Selection changes: {changes}
      </Muted>
    </Stack>
  );
}

export const Recommended: Story = { render: () => <CollectionSelect /> };
export const GhostTrigger: Story = { render: () => <CollectionSelect variant="ghost" /> };
export const Disabled: Story = { render: () => <CollectionSelect disabled /> };
export const Compact: Story = { render: () => <CollectionSelect density="compact" /> };

export const ReadOnly: Story = {
  render: () => <SelectControl label="Collection" items={options} value="engineering" readOnly />,
};

export const Unselected: Story = { render: () => <UnselectedSelect /> };
export const DynamicOptions: Story = { render: () => <ChangingOptions /> };

export const CompactComposedTrigger: Story = { render: () => <ComposedSelect /> };

export const NarrowPopup: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <CollectionSelect />,
};
