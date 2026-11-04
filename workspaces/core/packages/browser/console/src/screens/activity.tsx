import { Button, Muted, Row, Stack } from '@mechane-ai/ui';
import type { ConsoleData } from '@mechane/console-data';
import { Activity } from '@mechane/console-views';
import type { EventPage } from '@mechane/protocol';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';

/** Keep the displayed page until the reader asks to bring newer rows into view. */
function ActivityPage({
  page,
  latest,
  controls,
}: {
  readonly page: EventPage;
  readonly latest: boolean;
  readonly controls: (page: EventPage) => ReactNode;
}): ReactNode {
  const [shown, setShown] = useState(page);
  const visible = latest ? shown : page;
  const hasUnreadActivity = latest && page.events.at(-1)?.sequence !== visible.events.at(-1)?.sequence;

  return (
    <>
      {controls(visible)}
      {hasUnreadActivity && (
        <Row>
          <Button onClick={() => setShown(page)}>Show new activity ↑</Button>
        </Row>
      )}
      <Activity page={visible} />
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
            controls={(visible) => (
              <Row between>
                <Muted>
                  {before === null ? 'Recent activity · updates while this page is visible' : 'Earlier activity'}
                </Muted>
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
              </Row>
            )}
          />
        </Stack>
      )}
    </Resource>
  );
}
