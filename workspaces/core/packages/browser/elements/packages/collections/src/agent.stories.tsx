import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Row, Stack } from '../../core/src/index.ts';
import { Notice } from '../../feedback/src/index.ts';
import { createAgent } from '../../foundations/src/agent/index.ts';
import { DataTable } from './data-table.tsx';
import type { DataTableColumn } from './data-table.tsx';

const queryActions: ReadonlySet<string> = new Set(['setQuery', 'setFilter']);

const projects = [
  { name: 'Design archive', status: 'Archived' },
  { name: 'Design system', status: 'Active' },
  { name: 'Research archive', status: 'Archived' },
];

const columns = [
  { id: 'name', label: 'Project', role: 'primary', cell: (project) => project.name },
  { id: 'status', label: 'Status', role: 'status', cell: (project) => project.status },
] satisfies ReadonlyArray<DataTableColumn<(typeof projects)[number]>>;

function ProjectSearch(): ReactNode {
  const [error, setError] = useState('');

  async function findProjects(): Promise<void> {
    const agent = createAgent({
      allow: (step) =>
        step.confirm === undefined && step.component === 'collection-query' && queryActions.has(step.action),
    });

    const matches = await agent.query({ kind: 'collection-query', text: 'Archived' });

    if ('error' in matches) {
      setError(matches.error);

      return;
    }

    const table = matches.find((item) => item.label === 'Projects' && item.offPage !== true);
    const archived = table?.items?.find((item) => item.label === 'Status · Archived');

    if (table === undefined || archived === undefined) {
      setError('The archived status filter is unavailable.');

      return;
    }

    const result = await agent.act({
      steps: [
        { ref: table.ref, action: 'setQuery', args: ['design'] },
        { ref: table.ref, action: 'setFilter', args: [archived.value] },
      ],
    });

    setError(result.error?.message ?? '');
  }

  return (
    <Stack>
      <Row>
        <Button onClick={findProjects}>Find archived design projects</Button>
      </Row>
      {error.length > 0 && <Notice hasError>{error}</Notice>}
      <DataTable
        caption="Projects"
        columns={columns}
        rows={projects}
        getRowId={(project) => project.name}
        empty="No projects."
        query={{
          mode: 'local',
          search: (project) => project.name,
          filters: [{ id: 'status', label: 'Status', value: (project) => project.status }],
        }}
      />
    </Stack>
  );
}

const meta = {
  title: 'Collections/Agent interactions',
  component: ProjectSearch,
  parameters: {
    docs: {
      description: {
        component:
          'The host creates an agent when you run the example and permits the two table query actions. The agent discovers the available status filter and applies it alongside a search. Use the table controls to change either value.',
      },
    },
  },
} satisfies Meta<typeof ProjectSearch>;

export default meta;
export const ProjectQuery: StoryObj<typeof meta> = {};
