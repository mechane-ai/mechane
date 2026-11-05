import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Muted, Row, Stack } from '../../core/src/index.ts';
import { Fieldset, FilePicker, InputGroup, NumberField, Slider } from './form-controls.tsx';
import { Field } from './forms.tsx';

const meta = {
  title: 'Forms/Composed controls',
  component: NumberField.Root,
  subcomponents: {
    NumberGroup: NumberField.Group,
    NumberInput: NumberField.Input,
    Increment: NumberField.Increment,
    Decrement: NumberField.Decrement,
    Fieldset: Fieldset.Root,
    Legend: Fieldset.Legend,
    InputGroup: InputGroup.Root,
    Addon: InputGroup.Addon,
    Input: InputGroup.Input,
    FilePicker,
    Slider: Slider.Root,
    SliderLabel: Slider.Label,
    SliderValue: Slider.Value,
    SliderControl: Slider.Control,
    SliderTrack: Slider.Track,
    SliderIndicator: Slider.Indicator,
    SliderThumb: Slider.Thumb,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. NumberField offers exact numeric entry and step controls; Slider is for adjusting a bounded range. Both require an explicit locale for deterministic formatting. InputGroup keeps an input beside a noneditable prefix or suffix. Fieldset groups related fields. FilePicker retains the browser file dialog and change event; the application validates, stores, and uploads selected files. Choose Input for plain text and avoid a Slider when a precise value is essential.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Settings(): ReactNode {
  const [count, setCount] = useState<number | null>(4);
  const [threshold, setThreshold] = useState(60);
  const [fileNames, setFileNames] = useState('No files selected.');

  return (
    <Fieldset.Root>
      <Fieldset.Legend>Run settings</Fieldset.Legend>
      <Stack>
        <Field.Root>
          <Field.Label>Endpoint</Field.Label>
          <InputGroup.Root>
            <InputGroup.Addon>https://</InputGroup.Addon>
            <InputGroup.Input defaultValue="example.test" />
            <InputGroup.Addon>/api</InputGroup.Addon>
          </InputGroup.Root>
        </Field.Root>
        <Field.Root>
          <Field.Label>Concurrent jobs</Field.Label>
          <NumberField.Root locale="en-US" value={count} onValueChange={setCount} min={1} max={16}>
            <NumberField.Group>
              <NumberField.Decrement />
              <NumberField.Input />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
          <Field.Description>An empty input remains empty until the application accepts a value.</Field.Description>
        </Field.Root>
        <Slider.Root locale="en-US" value={threshold} onValueChange={setThreshold} min={0} max={100} step={5}>
          <Row between>
            <Slider.Label>Score threshold</Slider.Label>
            <Slider.Value />
          </Row>
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
            </Slider.Track>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
        <Field.Root>
          <Field.Label>Attachments</Field.Label>
          <FilePicker
            multiple
            accept=".txt,.json,.md"
            onChange={(event) => {
              const names = Array.from(event.target.files ?? []).map((file) => file.name);

              if (names.length === 0) {
                setFileNames('No files selected.');

                return;
              }

              setFileNames(names.join(', '));
            }}
          />
          <Field.Description>Text, JSON, or Markdown files. Nothing is uploaded by this example.</Field.Description>
          <Muted>{fileNames}</Muted>
        </Field.Root>
      </Stack>
    </Fieldset.Root>
  );
}

export const Recommended: Story = { render: () => <Settings /> };

export const InvalidInputGroup: Story = {
  render: () => (
    <Field.Root invalid>
      <Field.Label>Endpoint</Field.Label>
      <InputGroup.Root>
        <InputGroup.Addon>https://</InputGroup.Addon>
        <InputGroup.Input defaultValue="" required />
        <InputGroup.Addon>/api</InputGroup.Addon>
      </InputGroup.Root>
      <Field.Error match>Choose a host before saving this endpoint.</Field.Error>
    </Field.Root>
  ),
};

export const RangeAndDisabled: Story = {
  render: () => (
    <Stack>
      <Slider.Root locale="en-US" defaultValue={[20, 80]} min={0} max={100} step={10}>
        <Row between>
          <Slider.Label>Included scores</Slider.Label>
          <Slider.Value />
        </Row>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb index={0} aria-label="Minimum score" />
          <Slider.Thumb index={1} aria-label="Maximum score" />
        </Slider.Control>
      </Slider.Root>
      <Field.Root disabled>
        <Field.Label>Read-only capacity</Field.Label>
        <NumberField.Root locale="en-US" value={8} readOnly>
          <NumberField.Group>
            <NumberField.Decrement />
            <NumberField.Input />
            <NumberField.Increment />
          </NumberField.Group>
        </NumberField.Root>
      </Field.Root>
      <Slider.Root locale="en-US" defaultValue={50} disabled>
        <Slider.Label>Unavailable threshold</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    </Stack>
  ),
};
