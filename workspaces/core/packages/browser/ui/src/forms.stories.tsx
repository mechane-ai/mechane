import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './actions.tsx';
import { Field, Input, Textarea } from './forms.tsx';
import { Notice, Stack } from './surfaces.tsx';

const meta = {
  title: 'Forms/Field',
  component: Field.Root,
  subcomponents: { Label: Field.Label, Description: Field.Description, Error: Field.Error, Input, Textarea },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Field.Root associates a control with Field.Label, optional Field.Description, and Field.Error. Input keeps native input events; Textarea is for longer plain text. The application owns drafts, submission, permissions, and server errors. Choose defaultValue for an uncontrolled field, or value with its change callback for a controlled field. Use readOnly for a value that stays selectable; disabled means the control is unavailable. Labels remain visible when a placeholder is present.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function EditableForm(): ReactNode {
  const [name, setName] = useState('Release notes');
  const [description, setDescription] = useState('Summarize the changes people need to know.');
  const [isSaved, setIsSaved] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setIsSaved(true);
      }}
    >
      <Stack>
        <Field.Root name="name">
          <Field.Label>Name</Field.Label>
          <Input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setIsSaved(false);
            }}
          />
          <Field.Description>A short name people can recognize.</Field.Description>
          <Field.Error />
        </Field.Root>
        <Field.Root name="description">
          <Field.Label>Description</Field.Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          <Field.Description>Describe the result, without credentials or private configuration.</Field.Description>
        </Field.Root>
        <div>
          <Button type="submit" variant="solid">
            Save changes
          </Button>
        </div>
        {isSaved && <Notice>Example saved locally.</Notice>}
      </Stack>
    </form>
  );
}

export const Recommended: Story = { render: () => <EditableForm /> };

export const ValidationError: Story = {
  render: () => (
    <Field.Root name="name" invalid>
      <Field.Label>Name</Field.Label>
      <Input defaultValue="" required />
      <Field.Description>Choose a name for this item.</Field.Description>
      <Field.Error match>Name is required.</Field.Error>
    </Field.Root>
  ),
};

export const ReadOnlyAndDisabled: Story = {
  render: () => (
    <Stack>
      <Field.Root name="reference">
        <Field.Label>Reference</Field.Label>
        <Input readOnly value="example-2026-11" />
        <Field.Description>This value can be selected and copied.</Field.Description>
      </Field.Root>
      <Field.Root name="locked" disabled>
        <Field.Label>Archived name</Field.Label>
        <Input defaultValue="Release notes" disabled />
        <Field.Description>Restore the item before editing it.</Field.Description>
      </Field.Root>
    </Stack>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <Field.Root name="instructions">
      <Field.Label>Instructions for the next person reviewing this item</Field.Label>
      <Textarea defaultValue="Read the latest release notes, compare the listed changes with the previous version, and explain any remaining decisions in plain language.\n\nKeep the original references available for the reviewer." />
      <Field.Description>
        Help text can wrap across several lines without losing its association with the input or displacing the label.
      </Field.Description>
    </Field.Root>
  ),
};
