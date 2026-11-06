import { Button, Row, Stack } from '@mechane-ai/elements';
import { CollectionToolbar, ListFooter } from '@mechane-ai/elements/collections';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { Activity, ActivityPlaceholder } from '@mechane/console-views';
import type { EventPage, Turn } from '@mechane/protocol';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { PageLoadNotice } from '../page-read.tsx';
import type { PageRead } from '../page-read.tsx';
import { eventWindow, useEvents, useEventWindow } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

/** Keep the displayed page until the reader asks to bring newer rows into view. */
function ActivityPage({
  data,
  request,
  page,
  isLatest,
  controls,
  runLink,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'events'>;
  readonly page: EventPage;
  readonly isLatest: boolean;
  readonly controls: (page: EventPage) => ReactNode;
  readonly runLink: (turnId: Turn['id'], sequence: number) => ReactNode;
}): ReactNode {
  const currentWindow = useMemo(() => eventWindow(page), [page]);
  const [shown, setShown] = useState(currentWindow);
  const visibleWindow = isLatest ? shown : currentWindow;
  const lastShown = visibleWindow.sequences.at(-1);
  const hasUnreadActivity = isLatest && currentWindow.sequences.at(-1) !== lastShown;

  const visibleRequest =
    hasUnreadActivity && lastShown !== undefined ? data.reads.events(request.mechId, lastShown + 1) : request;

  const visibleState = useEventWindow(data, visibleRequest, visibleWindow);

  return (
    <>
      {hasUnreadActivity && (
        <CollectionToolbar label="New activity">
          <Button onClick={() => setShown(currentWindow)}>Show new activity</Button>
        </CollectionToolbar>
      )}
      <ResourceView state={visibleState} placeholder={<ActivityPlaceholder />}>
        {(visible, notice) => (
          <>
            {visibleRequest.id !== request.id && notice}
            <Activity page={{ ...visible, events: visible.events.toReversed() }} runLink={runLink} />
            {controls(visible)}
          </>
        )}
      </ResourceView>
    </>
  );
}

export function ActivityScreen({
  data,
  mechId,
  pageRead,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly pageRead: PageRead<'activity', ReadRequest<'events'>>;
}): ReactNode {
  const { request, cursors, setCursors, pending, failure } = pageRead;
  const state = useEvents(data, request);
  const before = cursors.at(-1) ?? null;

  return (
    <ResourceView state={state} placeholder={<ActivityPlaceholder />}>
      {(page, notice) => (
        <Stack>
          {notice}
          <ActivityPage
            data={data}
            request={request}
            key={before ?? 'latest'}
            page={page}
            isLatest={before === null}
            runLink={(turn, sequence) => (
              <ConsoleLink
                row={`event-${sequence}`}
                to={{ workspace: data.workspace.id, mech: mechId, view: 'activity', turn }}
              >
                Open run
              </ConsoleLink>
            )}
            controls={(visible) => {
              const hasPages = visible.hasMore || cursors.length > 0;
              const showPagination = hasPages || failure !== undefined;
              const isPreviousDisabled = cursors.length === 0 || pending !== undefined;
              const isNextDisabled = !visible.hasMore || pending !== undefined;

              return (
                showPagination && (
                  <ListFooter
                    actions={
                      <Row>
                        <Button
                          isPending={pending === 'previous'}
                          pendingLabel="Loading newer activity…"
                          disabled={isPreviousDisabled}
                          onClick={() => setCursors(cursors.slice(0, -1))}
                        >
                          Newer
                        </Button>
                        <Button
                          isPending={pending === 'next'}
                          pendingLabel="Loading older activity…"
                          disabled={isNextDisabled}
                          onClick={() => {
                            const first = visible.events[0];

                            if (first !== undefined) {
                              setCursors([...cursors, first.sequence]);
                            }
                          }}
                        >
                          Older
                        </Button>
                      </Row>
                    }
                  >
                    <PageLoadNotice failure={failure} />
                  </ListFooter>
                )
              );
            }}
          />
        </Stack>
      )}
    </ResourceView>
  );
}
