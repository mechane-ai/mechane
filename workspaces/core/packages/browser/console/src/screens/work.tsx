import type { ConsoleData } from '@mechane/console-data';
import { MemoryList, WorkList } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';

export function WorkScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const [cursors, setCursors] = usePageCursors('work', []);
  const after = cursors.at(-1);
  const source = useMemo(() => data.threads(mech.id, Option.fromNullishOr(after)), [data, mech.id, after]);
  const [selected, setSelected] = useState<string>();

  return (
    <Resource data={data} source={source}>
      {(page, notice) => (
        <>
          {notice}
          <WorkList
            page={page}
            selected={selected}
            onSelect={setSelected}
            hasPrevious={cursors.length > 0}
            onPrevious={() => setCursors(cursors.slice(0, -1))}
            onNext={() => {
              const last = page.threads.at(-1);

              if (last !== undefined) {
                setCursors([...cursors, last.id]);
              }
            }}
          />
        </>
      )}
    </Resource>
  );
}

export function MemoryScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const source = useMemo(() => data.memories(mech.id), [data, mech.id]);

  return (
    <Resource data={data} source={source}>
      {(page, notice) => (
        <>
          {notice}
          <MemoryList page={page} />
        </>
      )}
    </Resource>
  );
}
