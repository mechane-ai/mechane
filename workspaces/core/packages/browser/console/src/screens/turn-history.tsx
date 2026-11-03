import type { ConsoleData } from '@mechane/console-data';
import { Activity } from '@mechane/console-views';
import type { Turn } from '@mechane/protocol';
import { Button, Muted, Row, Stack, Subheading } from '@mechane/ui';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';

export function TurnHistory({
  data,
  mechId,
  turnId,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly turnId: Turn['id'];
}): ReactNode {
  const [cursors, setCursors] = useState<ReadonlyArray<number>>([]);
  const after = cursors.at(-1) ?? 0;
  const source = useMemo(() => data.turnEvents(mechId, turnId, after), [data, mechId, turnId, after]);

  return (
    <Stack compact>
      <Row between>
        <Subheading>Messages & events</Subheading>
        <Muted>This turn · chronological order</Muted>
      </Row>
      <Resource data={data} source={source}>
        {(page, notice) => (
          <Stack>
            {notice}
            <Activity page={page} chronological />
            {(page.hasMore || cursors.length > 0) && (
              <Row between>
                <Button disabled={cursors.length === 0} onClick={() => setCursors((previous) => previous.slice(0, -1))}>
                  Previous events
                </Button>
                <Button
                  disabled={!page.hasMore}
                  onClick={() => {
                    const last = page.events.at(-1);

                    if (last !== undefined) {
                      setCursors((previous) => [...previous, last.sequence]);
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
