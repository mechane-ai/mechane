import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Row, Stack } from '../../core/src/index.ts';
import { Notice } from '../../feedback/src/index.ts';
import { createAgent } from '../../foundations/src/agent/index.ts';
import type { DataTableColumn } from './data-table-layout.tsx';
import { DataTable } from './data-table.tsx';

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
  const [opened, setOpened] = useState('');

  async function findProjects(): Promise<void> {
    const agent = createAgent({
      allow: (step) => {
        const canQuery = step.component === 'collection-query' && queryActions.has(step.action);
        const canOpen = step.component === 'collection-results' && step.action === 'open';

        return step.confirm === undefined && (canQuery || canOpen);
      },
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

    if (!result.ok) {
      setError(result.error?.message ?? 'The project query failed.');

      return;
    }

    const results = await agent.query({ kind: 'collection-results', text: 'Projects' });
    const page = Array.isArray(results) ? results.find((item) => item.offPage !== true) : undefined;
    const record = page?.items?.[0];

    if (page?.['status'] !== 'ready' || record === undefined || page.items?.length !== 1) {
      setError('Expected one matching project.');

      return;
    }

    const response = await agent.act({ steps: [{ ref: page.ref, action: 'open', args: [record.value] }] });

    setError(response.error?.message ?? '');
  }

  return (
    <Stack>
      <Row>
        <Button onClick={findProjects}>Open archived design project</Button>
      </Row>
      {error.length > 0 && <Notice hasError>{error}</Notice>}
      {opened.length > 0 && <Notice>Opened {opened}</Notice>}
      <DataTable
        caption="Projects"
        columns={columns}
        rows={projects}
        getRowId={(project) => project.name}
        empty="No projects."
        rowAction={{ label: (project) => `Open ${project.name}`, onActivate: (project) => setOpened(project.name) }}
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
          'The host permits search, filter and record activation. The agent discovers an available status filter, reads the matching result and opens its record by stable ID. The same table controls remain available to the reader.',
      },
    },
  },
} satisfies Meta<typeof ProjectSearch>;

export default meta;
export const ProjectQuery: StoryObj<typeof meta> = {};
