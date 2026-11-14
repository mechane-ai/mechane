import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button, Stack } from '../../../core/src/index.ts';
import { CodeBlock } from './code-block.tsx';

const code =
  'import { run } from "./worker";\n\nconst task = {\n  name: "Inspect repository",\n  files: ["src/main.ts", "README.md"],\n};\n\nawait run(task);\n';

const meta = {
  title: 'Content/Code',
  component: CodeBlock,
  args: { code, filename: 'src/example.ts' },
  parameters: {
    docs: {
      description: {
        component:
          'CodeBlock presents supplied source with readable text before highlighting is ready. Choose DiffViewer for changes between revisions and Markdown for prose containing code. Applications supply original source, file identity and streaming state. The filename selects its language through Pierre unless an explicit language is supplied; annotations and selected lines use one-based source coordinates. Wrapping, line limits and highlighting do not change the copied source. Unsupported languages remain readable plain text, and truncated displays identify omitted content.',
      },
    },
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Source: Story = {};

export const Annotations: Story = {
  args: {
    selectedLines: { start: 3, end: 6 },
    annotations: [{ line: 5, content: 'These paths come from the supplied workspace.' }],
  },
};

export const Wrapped: Story = {
  args: {
    shouldWrap: true,
    showLineNumbers: false,
    code: 'A long source line can wrap inside the available width without clipping its contents or changing the copied value. '.repeat(
      5,
    ),
    language: 'text',
    filename: 'notes.txt',
  },
};

export const UnsupportedLanguage: Story = {
  args: {
    language: 'fictional-language',
    code: 'plain source remains readable\nincluding spacing\n',
    filename: 'source.unknown',
  },
};

export const Bounded: Story = { args: { maxLines: 3 } };
export const Empty: Story = { args: { code: '' } };

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  args: {
    filename: 'workspaces/evaluation/reports/measurement-comparison-with-complete-request-identifiers.ts',
    code: `const request = "${'recorded-request-identifier-'.repeat(10)}";\n\n${code}`,
    annotations: [{ line: 1, content: 'The full request identifier remains available in the supplied source.' }],
  },
};

export const Streaming: Story = { render: () => <StreamingExample /> };

function StreamingExample() {
  const [isComplete, setComplete] = useState(false);

  return (
    <Stack>
      <Button onClick={() => setComplete(!isComplete)}>
        {isComplete ? 'Show incomplete source' : 'Complete source'}
      </Button>
      <CodeBlock
        code={isComplete ? code : code.slice(0, 74)}
        filename="src/stream.ts"
        language="typescript"
        isStreaming={!isComplete}
      />
    </Stack>
  );
}
