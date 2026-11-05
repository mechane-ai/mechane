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

export const NarrowTable: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  args: {
    children:
      '| Check | Result | Evidence |\n| --- | --- | --- |\n| Restore | Passed | The recorded files match the archived snapshot. |\n| Runtime | Pending | The integration suite has not been run in this environment. |\n\n| Artifact | Location |\n| --- | --- |\n| Report | `/workspace/evaluation/artifacts/production/observations/archived-results/comparison-summary.json` |\n\nThe same path outside a table stays within the page: `/workspace/evaluation/artifacts/production/observations/archived-results/comparison-summary.json`.',
  },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  args: {
    children:
      '# Measurements for the recorded evaluation-comparison request\n\nReview the [complete measurement-comparison record](https://example.com/reports/comparison) and keep missing values separate from zero.\n\n- A matched baseline and candidate\n  - A long identifier: `evaluation-comparison-record-with-a-long-unbroken-identifier`\n- A supplied observation\n\n> The available evidence covers one recorded run.\n\n| Record | Observation |\n| --- | --- |\n| evaluation-comparison-record-with-a-long-unbroken-identifier | A complete measurement was recorded. |\n\n```text\nA source line remains horizontally inspectable even when the prose around it wraps inside a narrow column.\n```',
  },
};
