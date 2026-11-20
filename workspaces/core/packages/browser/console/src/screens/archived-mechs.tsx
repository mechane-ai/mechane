import { EmptyState } from '@mechane-ai/elements/feedback';
import { ToolbarAction, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { ConsoleData } from '@mechane/console-data';
import { ArchivedMechList, ArchivedMechListPlaceholder, SessionPagination } from '@mechane/console-views';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ListPage } from '../list-page.tsx';
import { useManagedPaging } from '../managed-paging.ts';
import { useArchivedMechs } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';

type Props = ConsoleNavigation & { readonly data: ConsoleData };

export function ArchivedMechsScreen(props: Props): ReactNode {
  const { data, navigate } = props;

  return (
    <ListPage
      kind="mechs"
      location={props.location}
      showQuery={data.workspace.role === 'owner'}
      title="Archived mechs"
      leading={
        <ToolbarAction
          icon={<ArrowLeft size={16} aria-hidden />}
          onClick={() => navigate({ workspace: data.workspace.id, view: 'definition' })}
        >
          Settings
        </ToolbarAction>
      }
    >
      <Workbench>
        <WorkbenchScroll isFlush label="Archived mechs">
          {data.workspace.role === 'owner' ? (
            <ArchivedMechs {...props} />
          ) : (
            <EmptyState title="Workspace owner access required" />
          )}
        </WorkbenchScroll>
      </Workbench>
    </ListPage>
  );
}

function ArchivedMechs({ data, location, navigate }: Props): ReactNode {
  const router = useRouter();
  const request = useMemo(() => data.reads.mechs(location.page ?? null, location), [data, location]);
  const archived = useArchivedMechs(data, request);
  const paging = useManagedPaging(location, data.workspace.id);

  function archive(mech: string) {
    return { workspace: data.workspace.id, mech, view: 'conversation' as const };
  }

  return (
    <ResourceView state={archived} label="Loading archived mechs" placeholder={<ArchivedMechListPlaceholder />}>
      {(page, notice) => (
        <>
          {notice}
          <ArchivedMechList
            mechs={page.mechs}
            href={(id) => router.buildLocation({ to: '/', search: archive(id) }).publicHref}
            onOpen={(id) => navigate(archive(id))}
          />
          <SessionPagination
            onPrevious={paging.previous}
            onNext={paging.next(page.hasMore ? (page.mechs.at(-1)?.id ?? null) : null)}
          />
        </>
      )}
    </ResourceView>
  );
}
