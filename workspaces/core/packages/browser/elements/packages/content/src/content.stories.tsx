import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../../core/src/index.ts';
import { ContentLink } from './content-link.tsx';
import { JsonViewer } from './json-viewer.tsx';
import { LogViewer } from './log-viewer.tsx';
import { Markdown } from './markdown/markdown.tsx';
import { StackTrace } from './stack-trace.tsx';

const meta = {
  title: 'Content/Recorded content',
  component: Markdown,
  subcomponents: { JsonViewer, LogViewer, StackTrace, ContentLink },
  parameters: {
    docs: {
      description: {
        component:
          'Choose Markdown for supplied prose, JsonViewer for structured values, LogViewer for recorded text output, and StackTrace for supplied error frames. CodeBlock is the source-code alternative. ContentLink accepts safe destinations and renders unsafe schemes as text; it does not authorize access. Applications redact values, supply frame identities and source coordinates, and own streaming or retrieval. Raw HTML and remote Markdown images stay inert. Bounded views disclose omitted content and preserve the complete supplied value for copying.',
      },
    },
  },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj;

export const MarkdownContent: Story = {
  args: {
    children:
      '# A recorded reply\n\nThe run completed with **two artifacts**. Inspect the [documentation](https://example.com/docs) before proceeding.\n\n- A prepared workspace\n- A summary with `request.id`\n\n> Keep the source available when highlighting is unavailable.\n\n| Step | Result |\n| --- | --- |\n| Prepare | Complete |\n| Review | Awaiting approval |\n\n```typescript\nconst request = { task: "inspect", retries: 2 };\nawait run(request);\n```',
  },
};

export const StreamingMarkdown: Story = {
  args: {
    isStreaming: true,
    children:
      'The worker is preparing **two files**.\n\n```typescript\nconst files = [\n  "src/main.ts",\n  "src/config.ts"',
  },
};

export const UntrustedContent: Story = {
  args: {
    children:
      '[Unsafe destination](javascript:alert(1))\n\n![Remote image is not loaded](https://example.com/tracker.png)\n\n<script>alert("never executes")</script>\n\n```html\n<img src="private-url" onerror="alert(1)">\n```',
  },
};

export const StructuredOutput: Story = {
  render: () => (
    <Stack>
      <JsonViewer
        label="Recorded request"
        value={{
          operation: 'inspect',
          status: 'complete',
          metrics: { tokens: 1200, cost: null },
          files: ['src/main.ts', 'README.md'],
          empty: [],
          enabled: true,
        }}
      />
      <JsonViewer
        label="Bounded nested value"
        maxDepth={2}
        maxEntries={2}
        value={{ first: { nested: { deeper: 'value' } }, second: null, third: true, fourth: 'Hidden by entry limit' }}
      />
    </Stack>
  ),
};

export const RecordedOutput: Story = {
  render: () => (
    <Stack>
      <LogViewer
        label="Build output"
        output={'$ pnpm build\n✓ Compiled source\n✓ Emitted assets\nBuild completed in 2.1s\n'}
      />
      <LogViewer label="Empty output" output="" />
      <LogViewer
        label="Bounded output"
        maxLines={2}
        output={'Preparing source\nCompiling modules\nWriting assets\nComplete\n'}
      />
    </Stack>
  ),
};

export const ErrorFrames: Story = {
  render: () => (
    <StackTrace
      message="Could not resolve the requested file"
      frames={[
        {
          id: 'resolve',
          name: 'resolveSource',
          file: 'src/source.ts',
          line: 18,
          column: 7,
          href: 'https://example.com/source.ts#L18',
          code: 'const source = resolveSource(path);\nreturn readSource(source);',
          language: 'typescript',
        },
        { id: 'main', name: 'main', file: 'src/main.ts', line: 42 },
      ]}
    />
  ),
};

const unsafeDestination = 'data:text/html,blocked';

export const SafeLinks: Story = {
  render: () => (
    <Stack>
      <ContentLink href="https://example.com/docs">Documentation</ContentLink>
      <ContentLink href="/local-path">Local destination</ContentLink>
      <ContentLink href={unsafeDestination}>Unsafe destination is plain text</ContentLink>
    </Stack>
  ),
};

export const EmptyFrames: Story = { render: () => <StackTrace message="No error frames were supplied." frames={[]} /> };

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => (
    <Stack>
      <JsonViewer
        label="Recorded measurement-comparison request with complete source identifiers"
        value={{
          request: 'evaluation-comparison-record-with-a-long-unbroken-identifier',
          result: { status: 'complete', missing: null, notes: 'Source values remain available for copying.' },
        }}
      />
      <LogViewer
        label="Recorded measurement-comparison output with complete source identifiers"
        isRunning
        output={'Preparing source\nInspecting evaluation-comparison-record-with-a-long-unbroken-identifier\n'}
      />
      <StackTrace
        message="Could not inspect evaluation-comparison-record-with-a-long-unbroken-identifier"
        frames={[
          {
            id: 'comparison',
            name: 'resolveRecordedMeasurementComparisonSource',
            file: 'workspaces/evaluation/reports/measurement-comparison.ts',
            line: 18,
            code: 'return resolveRecordedMeasurementComparisonSource(recordedRequestIdentifier);',
            language: 'typescript',
          },
          { id: 'untrusted', name: 'Untrusted frame destination remains plain text', href: unsafeDestination },
        ]}
      />
    </Stack>
  ),
};
