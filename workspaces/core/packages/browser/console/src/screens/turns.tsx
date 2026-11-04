import { Button } from '@mechane-ai/elements';
import { ListFooter } from '@mechane-ai/elements/collections';
import type { ConsoleData } from '@mechane/console-data';
import { TurnList } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink, usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';

export function TurnsScreen({
  data,
  mech,
  onMessage,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly onMessage: () => void;
}): ReactNode {
  const [cursors, setCursors] = usePageCursors('turns', []);
  const after = cursors.at(-1);
  const source = useMemo(() => data.turns(mech.id, Option.fromNullishOr(after)), [data, mech.id, after]);

  return (
    <Resource data={data} source={source}>
      {(page, notice) => (
        <>
          {notice}
          <TurnList
            page={page}
            turnLink={(id, children) => (
              <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn: id }} row={id} title="Open turn">
                {children}
              </ConsoleLink>
            )}
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
          {page.turns.length > 0 && (
            <ListFooter
              actions={
                <>
                  <Button disabled={cursors.length === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
                    Newer
                  </Button>
                  <Button
                    disabled={!page.hasMore}
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
              Newest turns first
            </ListFooter>
          )}
        </>
      )}
    </Resource>
  );
}
