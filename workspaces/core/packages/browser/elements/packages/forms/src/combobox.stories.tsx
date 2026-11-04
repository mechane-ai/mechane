import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '../../core/src/index.ts';
import { Combobox } from './combobox.tsx';
import { Field } from './forms.tsx';

type Choice = { readonly id: string; readonly label: string };

const choices: ReadonlyArray<Choice> = [
  { id: 'compact', label: 'Compact model' },
  { id: 'balanced', label: 'Balanced model' },
  { id: 'large', label: 'Large model' },
  { id: 'specialist', label: 'Specialist model with a longer descriptive name' },
];

const meta = {
  title: 'Forms/Combobox',
  component: Combobox.Root,
  subcomponents: {
    Label: Combobox.Label,
    InputGroup: Combobox.InputGroup,
    Input: Combobox.Input,
    Trigger: Combobox.Trigger,
    Clear: Combobox.Clear,
    Positioner: Combobox.Positioner,
    Popup: Combobox.Popup,
    List: Combobox.List,
    Item: Combobox.Item,
    ItemIndicator: Combobox.ItemIndicator,
    Empty: Combobox.Empty,
    Status: Combobox.Status,
    Group: Combobox.Group,
    GroupLabel: Combobox.GroupLabel,
    Chips: Combobox.Chips,
    Chip: Combobox.Chip,
    ChipRemove: Combobox.ChipRemove,
    Value: Combobox.Value,
    Collection: Combobox.Collection,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Combobox selects from a searchable option domain, with one or multiple selected values. Use Select when the options fit without search. Supply stable identifiers and label/value conversion for object records. Base UI owns intrinsic matching and keyboard movement. For server search, the application owns query results and passes filteredItems, inputValue, and onInputValueChange; never treat a bounded server page as the entire option domain. Pending and failed reads belong to the application, and Status can present their messages.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function choiceLabel(choice: Choice): string {
  return choice.label;
}

function choiceValue(choice: Choice): string {
  return choice.id;
}

function sameChoice(choice: Choice, value: Choice): boolean {
  return choice.id === value.id;
}

function ChoiceList(): ReactNode {
  return (
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.Empty>No matching models.</Combobox.Empty>
          <Combobox.List<Choice>>
            {(choice) => (
              <Combobox.Item key={choice.id} value={choice}>
                <Combobox.ItemIndicator />
                {choice.label}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

function SingleChoice(): ReactNode {
  const [selected, setSelected] = useState<Choice | null>(null);

  return (
    <Field.Root name="model">
      <Field.Label>Model</Field.Label>
      <Combobox.Root
        items={choices}
        value={selected}
        onValueChange={setSelected}
        itemToStringLabel={choiceLabel}
        itemToStringValue={choiceValue}
        isItemEqualToValue={sameChoice}
      >
        <Combobox.InputGroup>
          <Combobox.Input placeholder="Search models" />
          <Combobox.Clear />
          <Combobox.Trigger />
        </Combobox.InputGroup>
        <ChoiceList />
      </Combobox.Root>
      <Field.Description>Choose a model for the next request.</Field.Description>
    </Field.Root>
  );
}

function MultipleChoices(): ReactNode {
  const [selected, setSelected] = useState<Array<Choice>>([]);

  return (
    <Field.Root name="comparison-models">
      <Field.Label>Compare models</Field.Label>
      <Combobox.Root
        multiple
        items={choices}
        value={selected}
        onValueChange={setSelected}
        itemToStringLabel={choiceLabel}
        itemToStringValue={choiceValue}
        isItemEqualToValue={sameChoice}
      >
        <Combobox.InputGroup>
          <Combobox.Chips>
            {selected.map((choice) => (
              <Combobox.Chip key={choice.id}>
                {choice.label}
                <Combobox.ChipRemove aria-label={`Remove ${choice.label}`} />
              </Combobox.Chip>
            ))}
            <Combobox.Input placeholder="Add a model" />
          </Combobox.Chips>
          <Combobox.Trigger />
        </Combobox.InputGroup>
        <ChoiceList />
      </Combobox.Root>
      <Field.Description>Remove a selected model with its button or the keyboard.</Field.Description>
    </Field.Root>
  );
}

export const Recommended: Story = { render: () => <SingleChoice /> };
export const Multiple: Story = { render: () => <MultipleChoices /> };

export const DisabledAndEmpty: Story = {
  render: () => (
    <Stack>
      <Field.Root disabled>
        <Field.Label>Unavailable model selection</Field.Label>
        <Combobox.Root items={choices} disabled>
          <Combobox.InputGroup>
            <Combobox.Input placeholder="No permission to change models" />
            <Combobox.Trigger />
          </Combobox.InputGroup>
          <ChoiceList />
        </Combobox.Root>
      </Field.Root>
      <Field.Root>
        <Field.Label>Empty option domain</Field.Label>
        <Combobox.Root<Choice> items={[]} itemToStringLabel={choiceLabel}>
          <Combobox.InputGroup>
            <Combobox.Input placeholder="Search models" />
            <Combobox.Trigger />
          </Combobox.InputGroup>
          <ChoiceList />
        </Combobox.Root>
        <Field.Description>No models have been configured.</Field.Description>
      </Field.Root>
    </Stack>
  ),
};
