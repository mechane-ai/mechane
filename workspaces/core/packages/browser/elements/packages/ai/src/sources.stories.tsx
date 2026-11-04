import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Text } from '../../core/src/index.ts';
import { InlineCitation, Sources } from './sources.tsx';
import type { Source } from './sources.tsx';

const meta = {
  title: 'AI/Sources',
  component: Sources,
  subcomponents: { InlineCitation },
  parameters: {
    docs: {
      description: {
        component:
          'Sources preserves supplied source order and identity. InlineCitation opens the same supplied record in a Base UI popover by keyboard, pointer or touch. ContentLink shares Markdown’s destination policy; unsafe URL schemes render as text. Choose Sources for a reference list, InlineCitation for a reference within prose, and ContentLink for an ordinary destination without citation metadata. The application supplies provenance and decides which records are visible.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const source: Source = {
  id: 'comparison-guide',
  title: 'Evaluation comparison guide',
  href: 'https://example.com/evaluation',
  description: 'Synthetic reference for matched-case comparisons and missing measurements.',
};

const sources: ReadonlyArray<Source> = [
  source,
  {
    id: 'data-dictionary',
    title: 'Measurement data dictionary',
    href: 'https://example.com/measurements',
    description: 'Synthetic schema reference for recorded measurements.',
  },
];

export const Citations: Story = {
  render: () => (
    <Stack>
      <Text>
        Use matched cases for the comparison <InlineCitation source={source} label="[1]" /> and list the missing values
        separately.
      </Text>
      <Sources sources={sources} />
    </Stack>
  ),
};

export const UnsafeDestination: Story = {
  render: () => (
    <Sources
      sources={[
        {
          id: 'unsafe',
          title: 'Untrusted source',
          href: 'data:text/html,Untrusted%20content',
          description: 'The URL is deliberately unsafe. The title remains readable without an executable link.',
        },
      ]}
    />
  ),
};
