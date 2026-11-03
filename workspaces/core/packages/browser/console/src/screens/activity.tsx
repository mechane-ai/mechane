import type { ConsoleData } from '@mechane/console-data';
import { Activity } from '@mechane/console-views';
import { Button, Muted, Row, Stack } from '@mechane/ui';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';

export function ActivityScreen({ data, mechId }: { readonly data: ConsoleData; readonly mechId: string }): ReactNode {
  const [cursors, setCursors] = useState<ReadonlyArray<number>>([]);
  const before = cursors.at(-1) ?? null;
  const source = useMemo(() => data.events(mechId, before), [data, mechId, before]);

  return (
    <Resource data={data} source={source}>
      {(page) => (
        <Stack>
          <Row between>
            <Muted>
              {before === null ? 'Recent activity · updates while this page is visible' : 'Earlier activity'}
            </Muted>
            <Row>
              <Button disabled={cursors.length === 0} onClick={() => setCursors((previous) => previous.slice(0, -1))}>
                Newer
              </Button>
              <Button
                disabled={!page.hasMore}
                onClick={() => {
                  const first = page.events[0];

                  if (first !== undefined) {
                    setCursors((previous) => [...previous, first.sequence]);
                  }
                }}
              >
                Older
              </Button>
            </Row>
          </Row>
          <Activity page={page} />
        </Stack>
      )}
    </Resource>
  );
}
