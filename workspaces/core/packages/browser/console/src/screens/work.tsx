import { ViewStack } from '@mechane-ai/elements/layout';
import type { ConsoleData } from '@mechane/console-data';
import { MemoryList, WorkDetails, WorkList } from '@mechane/console-views';
import type { Mech, Thread, ThreadPage } from '@mechane/protocol';
import { Option } from 'effect';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink, readReaderPositions, restoreReaderPositions, usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ReaderPosition } from '../types.ts';

export function WorkScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const [cursors, setCursors] = usePageCursors('work', []);
  const after = cursors.at(-1);
  const source = useMemo(() => data.threads(mech.id, Option.fromNullishOr(after)), [data, mech.id, after]);

  return (
    <Resource data={data} source={source}>
      {(page, notice) => (
        <WorkPage
          page={page}
          notice={notice}
          hasPrevious={cursors.length > 0}
          onPrevious={() => setCursors(cursors.slice(0, -1))}
          onNext={() => {
            const last = page.threads.at(-1);

            if (last !== undefined) {
              setCursors([...cursors, last.id]);
            }
          }}
        />
      )}
    </Resource>
  );
}

function WorkPage({
  page,
  notice,
  hasPrevious,
  onPrevious,
  onNext,
}: {
  readonly page: ThreadPage;
  readonly notice: ReactNode;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}): ReactNode {
  const [selected, setSelected] = useState<Thread>();
  const selectedId = selected?.id;
  const [focusRowId, setFocusRowId] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const listPosition = useRef<ReadonlyArray<ReaderPosition>>([]);
  const observed = page.threads.find((thread) => thread.id === selectedId);

  if (observed !== undefined && observed !== selected) {
    setSelected(observed);
  }

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (selectedId === undefined) {
        restoreReaderPositions(listPosition.current);
      } else {
        heading.current
          ?.closest<HTMLElement>('[data-scroll-restoration-id]')
          ?.scrollTo({ top: 0, behavior: 'instant' });
        heading.current?.focus({ preventScroll: true });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  return (
    <ViewStack.Root>
      {notice}
      <ViewStack.Panel active={selected === undefined}>
        <WorkList
          page={page}
          selected={selectedId}
          focusRowId={focusRowId}
          onSelect={(id) => {
            const thread = page.threads.find((candidate) => candidate.id === id);

            if (thread === undefined) {
              return;
            }

            listPosition.current = readReaderPositions();

            setFocusRowId(undefined);
            setSelected(thread);
          }}
          hasPrevious={hasPrevious}
          onPrevious={onPrevious}
          onNext={onNext}
        />
      </ViewStack.Panel>
      {selected !== undefined && (
        <WorkDetails
          thread={selected}
          headingRef={heading}
          onBack={() => {
            setFocusRowId(selected.id);
            setSelected(undefined);
          }}
        />
      )}
    </ViewStack.Root>
  );
}

export function MemoryScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const source = useMemo(() => data.memories(mech.id), [data, mech.id]);

  return (
    <Resource data={data} source={source}>
      {(page, notice) => (
        <>
          {notice}
          <MemoryList
            page={page}
            runLink={(turn, path) => (
              <ConsoleLink
                to={{ workspace: data.workspace.id, mech: mech.id, view: 'memory', turn }}
                row={`memory:${path}`}
              >
                Open source run
              </ConsoleLink>
            )}
          />
        </>
      )}
    </Resource>
  );
}
