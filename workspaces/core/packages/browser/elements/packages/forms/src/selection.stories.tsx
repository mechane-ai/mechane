import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Row, Stack } from '../../core/src/index.ts';
import { Fieldset } from './form-controls.tsx';
import { Field } from './forms.tsx';
import { Checkbox, RadioGroup, Switch, ToggleGroup } from './selection.tsx';

const meta = {
  title: 'Forms/Selection',
  component: Checkbox.Root,
  subcomponents: {
    CheckboxIndicator: Checkbox.Indicator,
    RadioGroup: RadioGroup.Root,
    Radio: RadioGroup.Item,
    RadioIndicator: RadioGroup.Indicator,
    Switch: Switch.Root,
    SwitchThumb: Switch.Thumb,
    ToggleGroup: ToggleGroup.Root,
    ToggleItem: ToggleGroup.Item,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Checkbox represents a submitted choice; Switch represents an immediately applied setting. RadioGroup holds exclusive form values. ToggleGroup holds pressed view or formatting controls. Applications own selected values, permissions, and persistence. Use controlled values with their callback or an uncontrolled default, never both. Field.Label names each control. The compact visual marks retain larger touch targets.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Selections(): ReactNode {
  const [isEnabled, setIsEnabled] = useState(true);
  const [format, setFormat] = useState('summary');
  const [views, setViews] = useState(['table']);

  return (
    <Stack>
      <Field.Root>
        <Field.Label>
          <Row>
            <Checkbox.Root defaultChecked name="include-notes">
              <Checkbox.Indicator />
            </Checkbox.Root>
            Include notes in export
          </Row>
        </Field.Label>
      </Field.Root>
      <Field.Root>
        <Field.Label>
          <Row>
            <Switch.Root checked={isEnabled} onCheckedChange={setIsEnabled} name="notifications">
              <Switch.Thumb />
            </Switch.Root>
            Notify when complete
          </Row>
        </Field.Label>
        <Field.Description>The application decides how to save this setting.</Field.Description>
      </Field.Root>
      <Fieldset.Root>
        <Fieldset.Legend>Export format</Fieldset.Legend>
        <RadioGroup.Root value={format} onValueChange={setFormat} name="format" aria-label="Export format">
          <Field.Root>
            <Field.Label>
              <Row>
                <RadioGroup.Item value="summary">
                  <RadioGroup.Indicator />
                </RadioGroup.Item>
                Summary
              </Row>
            </Field.Label>
          </Field.Root>
          <Field.Root>
            <Field.Label>
              <Row>
                <RadioGroup.Item value="complete">
                  <RadioGroup.Indicator />
                </RadioGroup.Item>
                Complete records
              </Row>
            </Field.Label>
          </Field.Root>
        </RadioGroup.Root>
      </Fieldset.Root>
      <ToggleGroup.Root value={views} onValueChange={setViews} aria-label="View">
        <ToggleGroup.Item value="table">Table</ToggleGroup.Item>
        <ToggleGroup.Item value="chart">Chart</ToggleGroup.Item>
      </ToggleGroup.Root>
    </Stack>
  );
}

export const Recommended: Story = { render: () => <Selections /> };

export const MixedReadOnlyAndDisabled: Story = {
  render: () => (
    <Stack>
      <Field.Root>
        <Field.Label>
          <Row>
            <Checkbox.Root indeterminate checked={false} readOnly>
              <Checkbox.Indicator />
            </Checkbox.Root>
            Some records selected
          </Row>
        </Field.Label>
      </Field.Root>
      <Field.Root>
        <Field.Label>
          <Row>
            <Checkbox.Root checked readOnly>
              <Checkbox.Indicator />
            </Checkbox.Root>
            Required by policy
          </Row>
        </Field.Label>
      </Field.Root>
      <Field.Root disabled>
        <Field.Label>
          <Row>
            <Checkbox.Root disabled>
              <Checkbox.Indicator />
            </Checkbox.Root>
            Export unavailable
          </Row>
        </Field.Label>
      </Field.Root>
      <Field.Root disabled>
        <Field.Label>
          <Row>
            <Switch.Root disabled defaultChecked>
              <Switch.Thumb />
            </Switch.Root>
            Notifications unavailable
          </Row>
        </Field.Label>
      </Field.Root>
      <ToggleGroup.Root multiple defaultValue={['code', 'events']} aria-label="Visible sections">
        <ToggleGroup.Item value="code">Code</ToggleGroup.Item>
        <ToggleGroup.Item value="events">Events</ToggleGroup.Item>
        <ToggleGroup.Item value="metrics" disabled>
          Metrics
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </Stack>
  ),
};
