import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { agentAppearance, AgentAvatar, Row, Stack, Text } from '../../core/src/index.ts';
import { AgentAvatarPicker } from './agent-avatar-picker.tsx';

const meta = {
  title: 'Forms/Agent avatar picker',
  component: AgentAvatarPicker,
  parameters: {
    docs: {
      description: {
        component:
          'Controlled shape and color choices with an immediate preview and named selection. Use this for an agent identity; use a file input for a person’s photograph. Radio groups provide named choices, arrow-key selection, and a single tab stop per group. Controls grow for touch without changing their order. Applications own saved preferences, persistence errors, and reset actions. No backend or application provider is required.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function PickerExample(): ReactNode {
  const [value, setValue] = useState(() => agentAppearance('release-review'));

  return (
    <Stack>
      <Row>
        <AgentAvatar seed="release-review" appearance={value} size="md" />
        <Text>Release review</Text>
      </Row>
      <AgentAvatarPicker value={value} onValueChange={setValue} />
    </Stack>
  );
}

export const Recommended: Story = { render: () => <PickerExample /> };

export const Narrow: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };

export const Disabled: Story = {
  render: () => (
    <AgentAvatarPicker value={agentAppearance('release-review')} onValueChange={() => undefined} disabled />
  ),
};
