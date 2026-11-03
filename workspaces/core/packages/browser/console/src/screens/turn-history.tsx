import type { ConsoleData } from '@mechane/console-data';
import { Activity } from '@mechane/console-views';
import type { Turn } from '@mechane/protocol';
import { Button, Muted, Notice, Row, Stack, Subheading } from '@mechane/ui';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';

export function TurnHistory({
  data,
  mechId,
  turnId,
  target,
  onStart,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly turnId: Turn['id'];
  readonly target: number | undefined;
  readonly onStart: () => void;
}): ReactNode {
  const [cursors, setCursors] = usePageCursors('events', []);
  const after = cursors.at(-1) ?? (target === undefined ? 0 : target - 1);
  const linkedPage = target !== undefined && cursors.length === 0;
  const source = useMemo(() => data.turnEvents(mechId, turnId, after), [data, mechId, turnId, after]);

  return (
    <Stack compact>
      <Row between>
        <Subheading>Messages & events</Subheading>
        {target === undefined ? (
          <Muted>This turn · chronological order</Muted>
        ) : (
          <Button tone="link" onClick={onStart}>
            From the beginning →
          </Button>
        )}
      </Row>
      <Resource data={data} source={source}>
        {(page, notice) => (
          <Stack>
            {notice}
            {linkedPage && page.events[0]?.sequence !== target && (
              <Notice>The linked event is unavailable in this turn.</Notice>
            )}
            <Activity page={page} chronological />
            {(page.hasMore || cursors.length > 0) && (
              <Row between>
                <Button disabled={cursors.length === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
                  Previous events
                </Button>
                <Button
                  disabled={!page.hasMore}
                  onClick={() => {
                    const last = page.events.at(-1);

                    if (last !== undefined) {
                      setCursors([...cursors, last.sequence]);
                    }
                  }}
                >
                  Next events
                </Button>
              </Row>
            )}
          </Stack>
        )}
      </Resource>
    </Stack>
  );
}
