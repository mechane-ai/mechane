import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Subheading, TextLink } from '../../../core/src/index.ts';
import { MarkdownPreview } from './markdown-preview.tsx';
import { Markdown } from './markdown.tsx';

const meta = {
  title: 'Content/Markdown',
  component: Markdown,
  subcomponents: { MarkdownPreview },
  args: { children: 'A **saved result** with `inline code`.' },
  parameters: {
    docs: {
      description: {
        component:
          'Markdown renders supplied prose with safe links and explicit image links. Images never load automatically, and raw HTML stays inert. Set headingLevel to fit the surrounding document; nested headings keep their hierarchy up to h6. MarkdownPreview uses the same parser to produce inert text for excerpts inside links. The consumer truncates previews and supplies the full detail destination.',
      },
    },
  },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmbeddedDocument: Story = {
  render: () => (
    <Stack>
      <Subheading>Saved report</Subheading>
      <Markdown headingLevel={3}>
        {
          '# Result\n\nThe report contains **two artifacts**.\n\n## Evidence\n\nReview the `request.id`.\n\n##### Further detail\n\nDeep sections remain within the document’s heading hierarchy.'
        }
      </Markdown>
    </Stack>
  ),
};

export const UntrustedContent: Story = {
  args: {
    children:
      '[Unsafe link](javascript:alert(1))\n\n![Screenshot](https://example.com/private.png)\n\n![Unsafe image](data:text/html,blocked)\n\n<img src="https://example.com/tracker.png" onerror="alert(1)">',
  },
};

export const PreviewInsideLink: Story = {
  render: () => (
    <TextLink href="#saved-report">
      <MarkdownPreview>
        {
          '## A finding\n\n[Evidence](https://example.com/long-path) and **context** with `inline code`.\n\n![Screenshot](https://example.com/private.png)\n\n```typescript\nconst ready = true;\n```'
        }
      </MarkdownPreview>
    </TextLink>
  ),
};
