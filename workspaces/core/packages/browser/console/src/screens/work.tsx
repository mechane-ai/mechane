import { ViewStack } from '@mechane-ai/elements/layout';
import { decodeThread, recordKey } from '@mechane/console-data';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { MemoryList, MemoryListPlaceholder, WorkDetails, WorkList, WorkListPlaceholder } from '@mechane/console-views';
import type { Mech, Thread, ThreadPage } from '@mechane/protocol';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink, readReaderPositions, restoreReaderPositions } from '../navigation.tsx';
import { PageLoadNotice } from '../page-read.tsx';
import type { PageRead } from '../page-read.tsx';
import { useCanonicalRows, useMemories, useThreads } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ReaderPosition } from '../types.ts';

export function WorkScreen({
  data,
  pageRead,
}: {
  readonly data: ConsoleData;
  readonly pageRead: PageRead<'work', ReadRequest<'threads'>>;
}): ReactNode {
  const { request, cursors, setCursors, pending, failure, cancel } = pageRead;
  const state = useThreads(data, request);

  return (
    <ResourceView state={state} placeholder={<WorkListPlaceholder />}>
      {(page, notice) => (
        <WorkPage
          data={data}
          mechId={request.mechId}
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
    </ResourceView>
  );
}

function WorkPage({
  data,
  mechId,
  page,
  notice,
  pageNotice,
  hasPrevious,
  onPrevious,
  onNext,
  pending,
  onSelect,
}: {
  readonly data: ConsoleData;
  readonly mechId: string;
  readonly page: ThreadPage;
  readonly notice: ReactNode;
  readonly pageNotice?: ReactNode;
  readonly hasPrevious: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly pending: 'previous' | 'next' | undefined;
  readonly onSelect: () => void;
}): ReactNode {
  const [selectedId, setSelected] = useState<Thread['id']>();
  const [focusRowId, setFocusRowId] = useState<string>();
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingSelectionFocus = useRef<Thread['id'] | undefined>(undefined);
  const listPosition = useRef<ReadonlyArray<ReaderPosition>>([]);

  const selectedRows = useCanonicalRows(
    data,
    data.collections.threads,
    selectedId === undefined ? undefined : [recordKey(mechId, selectedId)],
  );

  const selectedRow = selectedRows.data?.[0];

  const selected =
    selectedRow === undefined ? page.threads.find((thread) => thread.id === selectedId) : decodeThread(selectedRow);

  const isSelectionReady = selected !== undefined;

  useLayoutEffect(() => {
    if (selectedId !== undefined && (!isSelectionReady || pendingSelectionFocus.current !== selectedId)) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (selectedId === undefined) {
        restoreReaderPositions(listPosition.current);
      } else if (heading.current !== null) {
        pendingSelectionFocus.current = undefined;

        heading.current.closest<HTMLElement>('[data-scroll-restoration-id]')?.scrollTo({ top: 0, behavior: 'instant' });
        heading.current.focus({ preventScroll: true });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isSelectionReady, selectedId]);

  return (
    <ViewStack.Root>
      {notice}
      <ViewStack.Panel isActive={selectedId === undefined}>
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
            pendingSelectionFocus.current = thread.id;

            setFocusRowId(undefined);
            setSelected(thread.id);
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
            pendingSelectionFocus.current = undefined;

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
  request,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly request: ReadRequest<'memories'>;
}): ReactNode {
  const state = useMemories(data, request);

  return (
    <ResourceView state={state} placeholder={<MemoryListPlaceholder />}>
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
    </ResourceView>
  );
}
