import { Text } from '@mechane-ai/elements';
import { useCollectionControls } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { PageContent, PageLayout } from '@mechane-ai/elements/layout';
import { ContentTabs } from '@mechane-ai/elements/navigation';
import type { PageNavigationItem } from '@mechane-ai/elements/navigation';
import { useState } from 'react';

type WorkspaceView = 'overview' | 'activity';
type WorkspaceEvent = { readonly id: string; readonly description: string };

type WorkspaceProps = {
  readonly project: string;
  readonly summary: string;
  readonly owner: string;
  readonly events: ReadonlyArray<WorkspaceEvent>;
  readonly views: ReadonlyArray<PageNavigationItem<WorkspaceView>>;
  readonly currentView: WorkspaceView;
  readonly onNavigate?: (view: PageNavigationItem<WorkspaceView>) => void;
};

/**
 * Build a tabbed workspace with real route links, search in the header action slot, and local panels. Keep route
 * selection in the router and use ContentTabs for panels within a route.
 */
export function TabbedWorkspace({ project, summary, owner, events, views, currentView, onNavigate }: WorkspaceProps) {
  const [query, setQuery] = useState('');

  const search = useCollectionControls({
    label: 'Activity controls',
    isReady: true,
    search: { label: 'Find activity', value: query, onChange: setQuery },
  });

  const matching = events.filter((event) => event.description.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <PageLayout
      title={project}
      showNavigation={false}
      navigation={{
        label: 'Project views',
        selectedId: currentView,
        items: views,
        ...(onNavigate !== undefined && { onNavigate }),
        actions: currentView === 'activity' && search.actions,
      }}
    >
      {currentView === 'overview' && (
        <ContentTabs
          label="Project details"
          items={[
            {
              id: 'summary',
              label: 'Summary',
              content: (
                <PageContent>
                  <Text>{summary}</Text>
                </PageContent>
              ),
            },
            {
              id: 'ownership',
              label: 'Ownership',
              content: (
                <PageContent>
                  <Text>{owner}</Text>
                </PageContent>
              ),
            },
          ]}
        />
      )}
      {currentView === 'activity' && (
        <PageContent>
          {matching.map((event) => (
            <Text key={event.id}>{event.description}</Text>
          ))}
          {matching.length === 0 && <EmptyState title="No matching activity" />}
        </PageContent>
      )}
    </PageLayout>
  );
}
