import { Button } from '@mechane-ai/elements';
import { ListFooter } from '@mechane-ai/elements/collections';
import type { ConsoleData } from '@mechane/console-data';
import { TurnList, TurnListPlaceholder } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { useRecordNavigation } from '../navigation.tsx';
import { PageLoadNotice } from '../page-source.tsx';
import type { PageSource } from '../page-source.tsx';
import { Resource } from '../resource.tsx';

export function TurnsScreen({
  data,
  mech,
  onMessage,
  pageSource,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly onMessage: () => void;
  readonly pageSource: PageSource<'turns', ReturnType<ConsoleData['turns']>>;
}): ReactNode {
  const records = useRecordNavigation();
  const { source, cursors, setCursors, pending, failure } = pageSource;

  return (
    <Resource data={data} source={source} placeholder={<TurnListPlaceholder />}>
      {(page, notice) => {
        const hasPages = page.hasMore || cursors.length > 0;
        const showPagination = hasPages || failure !== undefined;
        const isPreviousDisabled = cursors.length === 0 || pending !== undefined;
        const isNextDisabled = !page.hasMore || pending !== undefined;

        return (
          <>
            {notice}
            <TurnList
              page={page}
              turnHref={(turn) => records.href({ workspace: data.workspace.id, mech: mech.id, view: 'runs', turn })}
              onOpen={(turn) => records.open({ workspace: data.workspace.id, mech: mech.id, view: 'runs', turn }, turn)}
              focusRowId={records.focusRowId}
              emptyAction={
                mech.status === 'active' ? (
                  <Button variant="solid" onClick={onMessage}>
                    Send first message
                  </Button>
                ) : undefined
              }
              emptyDescription={
                mech.status === 'paused'
                  ? 'Messages wait in the inbox until you activate this mech.'
                  : mech.status === 'archived'
                    ? 'This mech was archived before it ran a turn.'
                    : 'Give this mech something to work on. Its answer and requests will appear here.'
              }
            />
            {showPagination && (
              <ListFooter
                actions={
                  <>
                    <Button
                      isPending={pending === 'previous'}
                      pendingLabel="Loading newer runs…"
                      disabled={isPreviousDisabled}
                      onClick={() => setCursors(cursors.slice(0, -1))}
                    >
                      Newer
                    </Button>
                    <Button
                      isPending={pending === 'next'}
                      pendingLabel="Loading older runs…"
                      disabled={isNextDisabled}
                      onClick={() => {
                        const last = page.turns.at(-1);

                        if (last !== undefined) {
                          setCursors([...cursors, last.id]);
                        }
                      }}
                    >
                      Older
                    </Button>
                  </>
                }
              >
                <PageLoadNotice failure={failure} />
              </ListFooter>
            )}
          </>
        );
      }}
    </Resource>
  );
}
