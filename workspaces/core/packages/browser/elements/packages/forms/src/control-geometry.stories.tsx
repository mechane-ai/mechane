import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, IconButton, Row, Stack } from '../../core/src/index.ts';
import { ButtonPlaceholder, FieldPlaceholder } from '../../feedback/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Combobox } from './combobox.tsx';
import { FormActions } from './form-actions.tsx';
import { FilePicker, InputGroup, NumberField } from './form-controls.tsx';
import { Field, Input, Textarea } from './forms.tsx';
import { Select } from './select.tsx';
import { Switch } from './selection.tsx';
import { SettingsRow } from './settings-row.tsx';
import { SettingsSection } from './settings-section.tsx';

const styles = stylex.create({
  controls: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 192px), 1fr))',
    gap: spacing.lg,
  },
  settings: { width: 640, maxWidth: '100%' },
});

const choices = ['Ready', 'In progress', 'Complete'];
const options = choices.map((value) => ({ label: value, value }));

const meta = {
  title: 'Forms/Control geometry',
  parameters: {
    docs: {
      description: {
        component:
          'Ordinary controls and their placeholders share one border-box height and typography. Compare the outer edges, grouped inputs, and file selector at desktop and coarse-pointer widths. Labels and descriptions stay outside that geometry. Textareas retain their row height and vertical growth. SettingsRow owns a bounded field column; FormActions owns action alignment, gap, and wrapping. The containing form or section owns separation from the fields.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

type StatusSelectProps = { readonly id?: string };

function StatusSelect({ id }: StatusSelectProps): ReactNode {
  return (
    <Select.Root items={options} defaultValue="Ready">
      <Select.Trigger id={id}>
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={16} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.List>
              {choices.map((choice) => (
                <Select.Item key={choice} value={choice}>
                  <Select.ItemText>{choice}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export const Recommended: Story = {
  render: () => (
    <Stack>
      <div {...stylex.props(styles.controls)}>
        <Field.Root>
          <Field.Label>Name</Field.Label>
          <Input defaultValue="Release notes" />
          <FieldPlaceholder />
        </Field.Root>
        <Field.Root>
          <Field.Label>Status</Field.Label>
          <StatusSelect />
          <FieldPlaceholder />
        </Field.Root>
        <Field.Root>
          <Field.Label>Search status</Field.Label>
          <Combobox.Root items={choices} defaultValue="Ready">
            <Combobox.InputGroup>
              <Combobox.Input />
              <Combobox.Trigger />
            </Combobox.InputGroup>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(choice: string) => (
                      <Combobox.Item key={choice} value={choice}>
                        {choice}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <FieldPlaceholder />
        </Field.Root>
        <Field.Root>
          <Field.Label>Endpoint</Field.Label>
          <InputGroup.Root>
            <InputGroup.Addon>https://</InputGroup.Addon>
            <InputGroup.Input defaultValue="example.test" />
          </InputGroup.Root>
          <FieldPlaceholder />
        </Field.Root>
        <Field.Root>
          <Field.Label>Concurrent jobs</Field.Label>
          <NumberField.Root locale="en-US" defaultValue={4} min={1}>
            <NumberField.Group>
              <NumberField.Decrement />
              <NumberField.Input />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
          <FieldPlaceholder />
        </Field.Root>
        <Field.Root>
          <Field.Label>Attachment</Field.Label>
          <FilePicker />
          <FieldPlaceholder />
        </Field.Root>
      </div>
      <Row>
        <Button variant="solid">Save changes</Button>
        <Button>Cancel</Button>
        <Button variant="ghost">Preview</Button>
        <Button nativeButton={false} render={<a href="#control-settings" />}>
          Open settings
        </Button>
        <ButtonPlaceholder />
        <IconButton aria-label="Settings">
          <Settings size={16} aria-hidden />
        </IconButton>
        <ButtonPlaceholder icon />
      </Row>
    </Stack>
  ),
};

export const TextareaRows: Story = {
  render: () => (
    <div {...stylex.props(styles.controls)}>
      <Field.Root>
        <Field.Label>Description</Field.Label>
        <Textarea rows={4} defaultValue="Describe the result." />
        <Field.Description>Four rows preserve the standard textarea minimum.</Field.Description>
      </Field.Root>
      <FieldPlaceholder
        label="Description"
        hint="Four rows preserve the standard textarea minimum."
        multiline
        rows={4}
      />
      <Field.Root>
        <Field.Label>Document</Field.Label>
        <Textarea rows={20} defaultValue="Write the longer document here." />
      </Field.Root>
      <FieldPlaceholder label="Document" multiline rows={20} />
    </div>
  ),
};

export const SettingsAndActions: Story = {
  render: () => (
    <div id="control-settings" {...stylex.props(styles.settings)}>
      <Stack>
        <SettingsSection title="Preferences" description="Fields align without application width overrides.">
          <SettingsRow label="Name" controlId="geometry-name" description="A recognizable name for the collection.">
            <Input id="geometry-name" aria-describedby="geometry-name-description" defaultValue="Release notes" />
          </SettingsRow>
          <SettingsRow label="Default status" controlId="geometry-status">
            <StatusSelect id="geometry-status" />
          </SettingsRow>
          <SettingsRow label="Notifications" controlId="geometry-notifications">
            <Switch.Root id="geometry-notifications" defaultChecked>
              <Switch.Thumb />
            </Switch.Root>
          </SettingsRow>
        </SettingsSection>
        <FormActions>
          <Button>Cancel</Button>
          <Button variant="solid">Save preferences</Button>
        </FormActions>
      </Stack>
    </div>
  ),
};
