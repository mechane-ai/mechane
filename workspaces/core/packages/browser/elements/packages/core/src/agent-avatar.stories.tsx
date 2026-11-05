import type { Meta, StoryObj } from '@storybook/react-vite';
import { agentAvatarShapes } from './agent-avatar-glyphs.tsx';
import { AgentAvatar, agentAvatarColors } from './agent-avatar.tsx';
import { Row, Stack } from './surfaces.tsx';
import { Text } from './text.tsx';

const meta = {
  title: 'Foundations/Agent avatar',
  component: AgentAvatar,
  parameters: {
    docs: {
      description: {
        component:
          'Original geometric identities, selected deterministically from a stable seed. A supplied appearance overrides the seed. The application owns persistence. Omit the label when the identity is beside a visible name; provide it when the avatar stands alone. Shape and color names are stable stored values. Keep the initial seeded catalogs frozen when extending picker choices so existing default identities never change.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Stack>
      <Row>
        <AgentAvatar seed="release-review" />
        <Text>Release review</Text>
      </Row>
      <Row>
        <AgentAvatar seed="service-health" />
        <Text>Service health</Text>
      </Row>
      <Row>
        <AgentAvatar seed="documentation" />
        <Text>Documentation</Text>
      </Row>
    </Stack>
  ),
};

export const Shapes: Story = {
  render: () => (
    <Row>
      {agentAvatarShapes.map((shape) => (
        <AgentAvatar key={shape} seed={shape} appearance={{ shape, color: 'cobalt' }} size="md" label={shape} />
      ))}
    </Row>
  ),
};

export const Colors: Story = {
  render: () => (
    <Row>
      {agentAvatarColors.map((color) => (
        <AgentAvatar key={color} seed={color} appearance={{ shape: 'facet', color }} size="md" label={color} />
      ))}
    </Row>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Row>
      <AgentAvatar seed="release-review" size="xs" label="16 pixels" />
      <AgentAvatar seed="release-review" size="sm" label="20 pixels" />
      <AgentAvatar seed="release-review" size="md" label="24 pixels" />
      <AgentAvatar seed="release-review" size="lg" label="40 pixels" />
    </Row>
  ),
};
