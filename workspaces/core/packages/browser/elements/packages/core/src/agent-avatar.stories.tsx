import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
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
          'Original layered identities with translucent petals, woven forms, and geometric facets. Use these to distinguish agents; use Icon for controls and Avatar for a person or photograph. Color identifies an agent and never communicates status. Omit the label beside a visible name; supply it when the mark stands alone. The application owns saved choices. Existing seed mappings and stored shape/color names remain stable when the picker catalog grows. Per-instance gradient IDs keep adjacent avatars independent in either theme.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({
  gallery: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: spacing.lg },
  identity: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
});

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
    <div {...stylex.props(styles.gallery)}>
      {agentAvatarShapes.map((shape) => (
        <div key={shape} {...stylex.props(styles.identity)}>
          <Row>
            <AgentAvatar seed={shape} appearance={{ shape, color: 'cobalt' }} size="xs" />
            <AgentAvatar seed={shape} appearance={{ shape, color: 'cobalt' }} size="lg" />
          </Row>
          <Text>{shape}</Text>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div {...stylex.props(styles.gallery)}>
      {agentAvatarColors.map((color) => (
        <div key={color} {...stylex.props(styles.identity)}>
          <AgentAvatar seed={color} appearance={{ shape: 'rosette', color }} size="lg" />
          <Text>{color}</Text>
        </div>
      ))}
    </div>
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
