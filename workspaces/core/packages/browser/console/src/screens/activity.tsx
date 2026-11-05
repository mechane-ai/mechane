import { Button, Row, Stack } from '@mechane-ai/elements';
import { CollectionToolbar, ListFooter } from '@mechane-ai/elements/collections';
import type { ConsoleData } from '@mechane/console-data';
import { Activity, ActivityPlaceholder } from '@mechane/console-views';
import type { EventPage, Turn } from '@mechane/protocol';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { PageLoadNotice } from '../page-source.tsx';
import type { PageSource } from '../page-source.tsx';
import { Resource } from '../resource.tsx';

/** Keep the displayed page until the reader asks to bring newer rows into view. */
function ActivityPage({
  page,
  latest,
  controls,
  runLink,
}: {
  readonly page: EventPage;
  readonly latest: boolean;
  readonly controls: (page: EventPage) => ReactNode;
  readonly runLink: (turnId: Turn['id'], sequence: number) => ReactNode;
}): ReactNode {
  const [shown, setShown] = useState(page);
  const visible = latest ? shown : page;
  const hasUnreadActivity = latest && page.events.at(-1)?.sequence !== visible.events.at(-1)?.sequence;

  return (
    <>
      {hasUnreadActivity && (
        <CollectionToolbar label="New activity">
          <Button onClick={() => setShown(page)}>Show new activity</Button>
        </CollectionToolbar>
      )}
      <Activity page={{ ...visible, events: visible.events.toReversed() }} runLink={runLink} />
      {controls(visible)}
    </>
  );
}

export function ActivityScreen({
  data,
  mechId,
  pageSource,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly pageSource: PageSource<'activity', ReturnType<ConsoleData['events']>>;
}): ReactNode {
  const { source, cursors, setCursors, pending, failure } = pageSource;
  const before = cursors.at(-1) ?? null;

  return (
    <Resource data={data} source={source} placeholder={<ActivityPlaceholder />}>
      {(page, notice) => (
        <Stack>
          {notice}
          <ActivityPage
            key={before ?? 'latest'}
            page={page}
            latest={before === null}
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
              const previousDisabled = cursors.length === 0 || pending !== undefined;
              const nextDisabled = !visible.hasMore || pending !== undefined;

              return (
                showPagination && (
                  <ListFooter
                    actions={
                      <Row>
                        <Button
                          pending={pending === 'previous'}
                          pendingLabel="Loading newer activity…"
                          disabled={previousDisabled}
                          onClick={() => setCursors(cursors.slice(0, -1))}
                        >
                          Newer
                        </Button>
                        <Button
                          pending={pending === 'next'}
                          pendingLabel="Loading older activity…"
                          disabled={nextDisabled}
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
    </Resource>
  );
}
