import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiffViewer } from './diff-viewer.tsx';

const before = {
  name: 'src/config.ts',
  language: 'typescript',
  code: 'export const config = {\n  retries: 1,\n  timeout: 5000,\n};\n',
};

const after = {
  name: 'src/config.ts',
  language: 'typescript',
  code: 'export const config = {\n  retries: 3,\n  timeout: 8000,\n  enabled: true,\n};\n',
};

const meta = {
  title: 'Content/Diff',
  component: DiffViewer,
  args: { label: 'Configuration changes', before, after },
  parameters: {
    docs: {
      description: {
        component:
          'DiffViewer compares supplied file revisions or presents a supplied patch. Choose CodeBlock when only one source version matters. Applications own revision identity, redaction and patch application; this view never edits files. File inputs distinguish additions and deletions with a missing side. Annotations identify both the old or new side and its one-based source line. The original inputs remain available while the lazy renderer loads or fails, and copy preserves the exact input.',
      },
    },
  },
} satisfies Meta<typeof DiffViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Split: Story = {};
export const Unified: Story = { args: { layout: 'unified' } };

export const Annotated: Story = {
  args: {
    annotations: [
      { file: after.name, side: 'old', line: 2, content: 'The earlier policy allowed one retry.' },
      { file: after.name, side: 'new', line: 4, content: 'This flag is new.' },
    ],
  },
};

export const Added: Story = { args: { before: null, after } };
export const Removed: Story = { args: { before, after: null } };

export const Patch: Story = {
  render: () => (
    <DiffViewer
      label="Recorded patch"
      patch={
        'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1,2 +1,2 @@\n # Example\n-Run locally.\n+Run locally or self-host.\n'
      }
    />
  ),
};

export const EmptyPatch: Story = { render: () => <DiffViewer label="No changes" patch="" /> };
