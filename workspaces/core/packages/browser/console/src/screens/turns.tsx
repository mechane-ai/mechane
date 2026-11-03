import type { ConsoleData } from '@mechane/console-data';
import { TurnList } from '@mechane/console-views';
import type { Turn } from '@mechane/protocol';
import { Button, Muted, Row, Stack } from '@mechane/ui';
import { Option } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Resource } from '../resource.tsx';

export function TurnsScreen({
  data,
  mechId,
  onTurn,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly onTurn: (id: string) => void;
}): ReactNode {
  const [cursors, setCursors] = useState<ReadonlyArray<Turn['id']>>([]);
  const after = cursors.at(-1);
  const source = useMemo(() => data.turns(mechId, Option.fromNullishOr(after)), [data, mechId, after]);

  return (
    <Resource data={data} source={source}>
      {(page) => (
        <Stack>
          <TurnList page={page} onOpen={onTurn} />
          <Row between>
            <Muted>Newest turns first</Muted>
            <Row>
              <Button disabled={cursors.length === 0} onClick={() => setCursors((previous) => previous.slice(0, -1))}>
                Newer
              </Button>
              <Button
                disabled={!page.hasMore}
                onClick={() => {
                  const last = page.turns.at(-1);

                  if (last !== undefined) {
                    setCursors((previous) => [...previous, last.id]);
                  }
                }}
              >
                Older
              </Button>
            </Row>
          </Row>
        </Stack>
      )}
    </Resource>
  );
}
