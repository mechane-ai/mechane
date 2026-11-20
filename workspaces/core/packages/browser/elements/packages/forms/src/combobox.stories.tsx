import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '../../core/src/index.ts';
import type { ControlDensity } from '../../core/src/index.ts';
import { Combobox } from './combobox.tsx';
import { Field } from './forms.tsx';

const choices = [
  { value: 'compact', label: 'Compact model' },
  { value: 'balanced', label: 'Balanced model' },
  { value: 'large', label: 'Large model' },
  { value: 'specialist', label: 'Specialist model with a longer descriptive name' },
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
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Combobox selects from a searchable option domain, with one or multiple selected values. Use Select when the options fit without search. Set density on Root so its input, trigger, clear button, and chips agree. Compact fits a local report control; standard is the default, including popup options and unrelated nested controls. Supply stable identifiers and label/value conversion for object records. UI SDK handles matching and keyboard movement. For server search, the application owns query results and renders its results as Item children with filter={false}, query and onQueryChange; never treat a bounded server page as the entire option domain. Pending and failed reads belong to the application, and Status can present their messages.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ChoiceList({ choices: options = choices }: { readonly choices?: typeof choices }): ReactNode {
  return (
    <Combobox.Popup>
      <Combobox.Empty>No matching models.</Combobox.Empty>
      <Combobox.List>
        {options.map((choice) => (
          <Combobox.Item key={choice.value} value={choice.value} label={choice.label}>
            <Combobox.ItemIndicator />
            {choice.label}
          </Combobox.Item>
        ))}
      </Combobox.List>
    </Combobox.Popup>
  );
}

type ChoiceExampleProps = { readonly density?: ControlDensity };

function SingleChoice({ density = 'standard' }: ChoiceExampleProps): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Field.Root name="model">
      <Field.Label>Model</Field.Label>
      <Combobox.Root density={density} value={selected} onValueChange={setSelected}>
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

function MultipleChoices({ density = 'standard' }: ChoiceExampleProps): ReactNode {
  const [selected, setSelected] = useState<Array<string>>([]);

  return (
    <Field.Root name="comparison-models">
      <Field.Label>Compare models</Field.Label>
      <Combobox.Root multiple density={density} value={selected} onValueChange={setSelected}>
        <Combobox.InputGroup>
          <Combobox.Chips>
            {choices
              .filter((choice) => selected.includes(choice.value))
              .map((choice) => (
                <Combobox.Chip key={choice.value} value={choice.value}>
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

export const Compact: Story = {
  render: () => (
    <Stack>
      <SingleChoice density="compact" />
      <MultipleChoices density="compact" />
    </Stack>
  ),
};

export const DisabledAndEmpty: Story = {
  render: () => (
    <Stack>
      <Field.Root disabled>
        <Field.Label>Unavailable model selection</Field.Label>
        <Combobox.Root disabled>
          <Combobox.InputGroup>
            <Combobox.Input placeholder="No permission to change models" />
            <Combobox.Trigger />
          </Combobox.InputGroup>
          <ChoiceList />
        </Combobox.Root>
      </Field.Root>
      <Field.Root>
        <Field.Label>Empty option domain</Field.Label>
        <Combobox.Root<string>>
          <Combobox.InputGroup>
            <Combobox.Input placeholder="Search models" />
            <Combobox.Trigger />
          </Combobox.InputGroup>
          <ChoiceList choices={[]} />
        </Combobox.Root>
        <Field.Description>No models have been configured.</Field.Description>
      </Field.Root>
    </Stack>
  ),
};
