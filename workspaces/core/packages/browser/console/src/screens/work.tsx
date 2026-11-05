import { ViewStack } from '@mechane-ai/elements/layout';
import type { ConsoleData } from '@mechane/console-data';
import { MemoryList, MemoryListPlaceholder, WorkDetails, WorkList, WorkListPlaceholder } from '@mechane/console-views';
import type { Mech, Thread, ThreadPage } from '@mechane/protocol';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink, readReaderPositions, restoreReaderPositions } from '../navigation.tsx';
import { PageLoadNotice } from '../page-source.tsx';
import type { PageSource } from '../page-source.tsx';
import { Resource } from '../resource.tsx';
import type { ReaderPosition } from '../types.ts';

export function WorkScreen({
  data,
  pageSource,
}: {
  readonly data: ConsoleData;
  readonly pageSource: PageSource<'work', ReturnType<ConsoleData['threads']>>;
}): ReactNode {
  const { source, cursors, setCursors, pending, failure, cancel } = pageSource;

  return (
    <Resource data={data} source={source} placeholder={<WorkListPlaceholder />}>
      {(page, notice) => (
        <WorkPage
          page={page}
          notice={notice}
          pageNotice={failure === undefined ? undefined : <PageLoadNotice failure={failure} />}
          pending={pending}
          onSelect={cancel}
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
  pageNotice,
  hasPrevious,
  onPrevious,
  onNext,
  pending,
  onSelect,
}: {
  readonly page: ThreadPage;
  readonly notice: ReactNode;
  readonly pageNotice?: ReactNode;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly pending: 'previous' | 'next' | undefined;
  readonly onSelect: () => void;
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
      <ViewStack.Panel isActive={selected === undefined}>
        <WorkList
          page={page}
          selected={selectedId}
          focusRowId={focusRowId}
          onSelect={(id) => {
            onSelect();

            const thread = page.threads.find((candidate) => candidate.id === id);

            if (thread === undefined) {
              return;
            }

            listPosition.current = readReaderPositions();

            setFocusRowId(undefined);
            setSelected(thread);
          }}
          hasPrevious={hasPrevious}
          loadingPage={pending}
          pageNotice={pageNotice}
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

export function MemoryScreen({
  data,
  mech,
  source,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly source: ReturnType<ConsoleData['memories']>;
}): ReactNode {
  return (
    <Resource data={data} source={source} placeholder={<MemoryListPlaceholder />}>
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
