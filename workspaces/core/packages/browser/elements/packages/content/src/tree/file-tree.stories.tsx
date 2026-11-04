import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button, Stack, Text } from '../../../core/src/index.ts';
import { FileTree } from './file-tree.tsx';

const paths = ['src/main.ts', 'src/config.ts', 'src/styles.css', 'docs/setup.md', 'README.md'];

const meta = {
  title: 'Content/File tree',
  component: FileTree,
  parameters: {
    docs: {
      description: {
        component:
          'FileTree presents a supplied path hierarchy with controlled file selection and optional change status. Choose DataTable for comparable records without a directory hierarchy. Applications supply paths, selected paths and changes, then decide what opening a file means. The tree owns expansion and keyboard navigation; updating supplied paths preserves its model and surviving expansion. It does not load a filesystem, mutate files or infer repository status.',
      },
    },
  },
} satisfies Meta<typeof FileTree>;

export default meta;
type Story = StoryObj;

export const Workspace: Story = { render: () => <TreeExample /> };

export const Empty: Story = {
  render: () => <FileTree label="Files" paths={[]} selectedPaths={[]} onSelectedPathsChange={() => undefined} />,
};

function TreeExample() {
  const [selectedPaths, setSelectedPaths] = useState<ReadonlyArray<string>>(['src/main.ts']);
  const [hasMetricsFile, setMetricsFilePresence] = useState(false);
  const currentPaths = hasMetricsFile ? [...paths, 'src/metrics.ts'] : paths;

  return (
    <Stack>
      <Button onClick={() => setMetricsFilePresence(!hasMetricsFile)}>
        {hasMetricsFile ? 'Remove metrics file' : 'Add metrics file'}
      </Button>
      <FileTree
        label="Workspace files"
        paths={currentPaths}
        selectedPaths={selectedPaths}
        onSelectedPathsChange={setSelectedPaths}
        statuses={[
          { path: 'src/config.ts', status: 'modified' },
          { path: 'src/metrics.ts', status: 'added' },
        ]}
      />
      <Text>Selected: {selectedPaths.length === 0 ? 'None' : selectedPaths.join(', ')}</Text>
    </Stack>
  );
}
