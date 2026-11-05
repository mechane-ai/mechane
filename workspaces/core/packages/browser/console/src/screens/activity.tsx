import { Button, Row, Stack } from '@mechane-ai/elements';
import { CollectionToolbar, ListFooter } from '@mechane-ai/elements/collections';
import type { ConsoleData } from '@mechane/console-data';
import { Activity } from '@mechane/console-views';
import type { EventPage, Turn } from '@mechane/protocol';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink, usePageCursors } from '../navigation.tsx';
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

export function ActivityScreen({ data, mechId }: { readonly data: ConsoleData; readonly mechId: string }): ReactNode {
  const [cursors, setCursors] = usePageCursors('activity', []);
  const before = cursors.at(-1) ?? null;
  const source = useMemo(() => data.events(mechId, before), [data, mechId, before]);

  return (
    <Resource data={data} source={source}>
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
            controls={(visible) =>
              (visible.hasMore || cursors.length > 0) && (
                <ListFooter
                  actions={
                    <Row>
                      <Button disabled={cursors.length === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
                        Newer
                      </Button>
                      <Button
                        disabled={!visible.hasMore}
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
                />
              )
            }
          />
        </Stack>
      )}
    </Resource>
  );
}
