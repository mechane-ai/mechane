import { Text, TextLink } from '@mechane-ai/elements';
import { PageContent, PageLayout } from '@mechane-ai/elements/layout';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { SearchableCollection } from '../../../recipes/searchable-collection.tsx';
import type { Worker, WorkerQuery, WorkerRead } from '../../../recipes/searchable-collection.tsx';
import { useStoryLocation } from './use-story-location.ts';

const meta = {
  title: 'Recipes/Searchable Collection',
  component: SearchableCollection,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SearchableCollection>;

export default meta;

const names = ['Atlas', 'Birch', 'Cedar', 'Delta', 'Elm', 'Finch', 'Granite', 'Haven', 'Iris'];

const workers = names.map((name, index) => ({
  id: name.toLowerCase(),
  name,
  status: index % 2 === 0 ? 'Available' : 'Busy',
}));

const pageSize = 3;

function loadPage(query: WorkerQuery) {
  const matching = workers.filter((worker) => {
    const matchesName = worker.name.toLowerCase().includes(query.text.trim().toLowerCase());

    return matchesName && (query.status === '' || worker.status === query.status);
  });

  const direction = query.sort?.direction === 'descending' ? -1 : 1;

  const ordered =
    query.sort === undefined
      ? matching
      : matching.toSorted((first, second) => direction * first.name.localeCompare(second.name));

  const start = (query.page - 1) * pageSize;

  return {
    rows: ordered.slice(start, start + pageSize),
    number: query.page,
    hasNext: start + pageSize < matching.length,
  };
}

function workerHref(worker: Worker) {
  return `#worker-${encodeURIComponent(worker.id)}`;
}

function WorkersExample() {
  const [query, setQuery] = useState<WorkerQuery>({ text: '', status: '', page: 1, sort: undefined });
  const [result, setResult] = useState<WorkerRead>(() => ({ status: 'ready', page: loadPage(query) }));
  const [attempt, setAttempt] = useState(0);
  const route = useStoryLocation();
  const worker = workers.find((record) => workerHref(record) === route);

  useEffect(() => {
    const request = setTimeout(() => setResult({ status: 'ready', page: loadPage(query) }), 250);

    return () => clearTimeout(request);
  }, [query, attempt]);

  function startQuery(next: WorkerQuery) {
    setResult((previous) => ({ status: 'pending', ...(previous.page !== undefined && { page: previous.page }) }));
    setQuery(next);
  }

  if (worker !== undefined) {
    return (
      <PageLayout title={worker.name} showNavigation={false}>
        <PageContent>
          <Text>{worker.status}</Text>
          <TextLink href="#workers">Back to workers</TextLink>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <SearchableCollection
      query={query}
      result={result}
      onQueryChange={startQuery}
      onRetry={() => setAttempt((previous) => previous + 1)}
      workerHref={workerHref}
    />
  );
}

export const Example: StoryObj = { render: () => <WorkersExample /> };
