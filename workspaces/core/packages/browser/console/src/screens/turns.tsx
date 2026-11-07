import { Button } from '@mechane-ai/elements';
import { ListFooter } from '@mechane-ai/elements/collections';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { TurnList, TurnListPlaceholder } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { useRecordNavigation } from '../navigation.tsx';
import { PageLoadNotice } from '../page-read.tsx';
import type { PageRead } from '../page-read.tsx';
import { useTurns } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function TurnsScreen({
  data,
  mech,
  sessionId,
  onMessage,
  pageRead,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly sessionId?: string | undefined;
  readonly onMessage: () => void;
  readonly pageRead: PageRead<'turns', ReadRequest<'turns'>>;
}): ReactNode {
  const records = useRecordNavigation();
  const { request, cursors, setCursors, pending, failure } = pageRead;
  const state = useTurns(data, request);

  const base = {
    workspace: data.workspace.id,
    mech: mech.id,
    view: 'runs' as const,
    ...(sessionId === undefined ? {} : { session: sessionId }),
  };

  return (
    <ResourceView state={state} placeholder={<TurnListPlaceholder />}>
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
              turnHref={(turn) => records.href({ ...base, turn })}
              onOpen={(turn) => records.open({ ...base, turn }, turn)}
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
    </ResourceView>
  );
}
