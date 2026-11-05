import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CodeBlock } from '../../content/src/code/index.ts';
import { FileTree } from '../../content/src/tree/index.ts';
import { Muted } from '../../core/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';

const meta = {
  title: 'AI/Workspace',
  parameters: {
    docs: {
      description: {
        component:
          'A file workspace composes the controlled FileTree with the selected source viewer. The application owns paths, file contents, statuses and selection. These synthetic files are supplied locally; the components do not read a filesystem, fetch content or execute code.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({
  workspace: {
    display: 'grid',
    gridTemplateColumns: { default: '220px minmax(0, 1fr)', [conditions.compactTable]: 'minmax(0, 1fr)' },
    gap: spacing.lg,
    minWidth: 0,
    alignItems: 'start',
  },
});

const files = [
  {
    path: 'README.md',
    language: 'markdown',
    content: '# Evaluation workspace\n\nCompare matched cases and report missing evidence.',
  },
  {
    path: 'src/compare.ts',
    language: 'typescript',
    content:
      'export function difference(baseline: number, candidate: number): number {\n  return candidate - baseline;\n}\n',
  },
  {
    path: 'results/comparison.json',
    language: 'json',
    content: '{\n  "matchedCases": 22,\n  "missingCases": ["case-07", "case-19"]\n}\n',
  },
];

function WorkspaceExample(): ReactNode {
  const [selectedPaths, setSelectedPaths] = useState<ReadonlyArray<string>>(['src/compare.ts']);
  const selectedFile = files.find((file) => file.path === selectedPaths[0]);

  return (
    <div {...stylex.props(styles.workspace)}>
      <FileTree
        paths={files.map((file) => file.path)}
        label="Supplied workspace files"
        selectedPaths={selectedPaths}
        onSelectedPathsChange={setSelectedPaths}
        statuses={[{ path: 'src/compare.ts', status: 'modified' }]}
        height={320}
      />
      {selectedFile === undefined ? (
        <Muted>Select a file to inspect its supplied content.</Muted>
      ) : (
        <CodeBlock filename={selectedFile.path} language={selectedFile.language} code={selectedFile.content} />
      )}
    </div>
  );
}

export const Files: Story = { render: () => <WorkspaceExample /> };

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <WorkspaceExample />,
};
