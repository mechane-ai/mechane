import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row, Stack } from './surfaces.tsx';
import { Badge, Heading, Identifier, Muted, Prose, Status, Subheading, Text } from './text.tsx';

const meta = {
  title: 'Foundations/Text',
  component: Text,
  subcomponents: { Heading, Subheading, Muted, Identifier, Prose, Badge, Status },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Text is ordinary UI copy; Heading and Subheading create the page hierarchy. Muted is supporting copy, Identifier is a machine-readable reference, and Prose preserves bounded plain-text output. Badge is a compact label; Status pairs a readable state with an icon. The application supplies wording, formatted values, and status meaning. Use actual heading levels for structure, and keep a text label beside semantic color. Long output belongs in its owning bounded view, not an unbounded Prose block.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Stack>
      <Heading>Release notes</Heading>
      <Muted>Saved a few minutes ago.</Muted>
      <Subheading>Summary</Subheading>
      <Text>The reviewed changes are ready for the next step.</Text>
      <Identifier>f0cd0c56-89c8-4875-a63f-8dc822a9af26</Identifier>
      <Prose>{'This is bounded plain text.\nLine breaks remain visible, and <markup> is displayed as text.'}</Prose>
    </Stack>
  ),
};

export const StatusLabels: Story = {
  render: () => (
    <Stack compact>
      <Row>
        <Status>Not started</Status>
        <Status tone="positive">Completed</Status>
        <Status tone="warning">Waiting</Status>
        <Status tone="negative">Unavailable</Status>
      </Row>
      <Row>
        <Badge>Draft</Badge>
        <Badge tone="positive">Published</Badge>
        <Badge tone="warning">Review needed</Badge>
        <Badge tone="negative">Archived</Badge>
      </Row>
    </Stack>
  ),
};

export const TextRoles: Story = {
  render: () => (
    <Stack compact>
      <Text variant="body">Ordinary UI text</Text>
      <Text variant="caption" tone="muted">
        Supporting label
      </Text>
      <Text variant="mono">example-reference-2026</Text>
      <Text variant="prose">Bounded plain text that remains readable across lines.</Text>
    </Stack>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Stack>
      <Heading>A release name that needs enough room to remain readable</Heading>
      <Identifier>example-reference-with-a-long-unbroken-suffix-0123456789abcdef0123456789abcdef</Identifier>
      <Prose>
        {
          'Long text wraps within its container.\n\nhttps://example.invalid/a/long/reference/that-must-remain-readable-without-making-the-entire-page-wider'
        }
      </Prose>
    </Stack>
  ),
};
