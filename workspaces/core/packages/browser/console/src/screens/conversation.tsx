import { AgentAvatar, Button } from '@mechane-ai/elements';
import { Conversation, MessageAction } from '@mechane-ai/elements/ai';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { ConversationPlaceholder, MechConversation } from '@mechane/console-views';
import type { EventPage, Mech } from '@mechane/protocol';
import { ScanLine } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';
import { ConsoleLink, useReaderPosition } from '../navigation.tsx';
import { PageLoadNotice } from '../page-read.tsx';
import type { PageRead } from '../page-read.tsx';
import { eventWindow, sameEventWindow, useEvents, useEventWindow } from '../reads.ts';
import { ResourceView } from '../resource.tsx';

export function ConversationScreen({
  data,
  mech,
  isActive,
  pageRead,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly isActive: boolean;
  readonly pageRead: PageRead<'conversation', ReadRequest<'events'>>;
}): ReactNode {
  const { request, cursors, setCursors, pending, failure } = pageRead;
  const state = useEvents(data, request);
  const pendingLatestFocus = useRef(false);
  const before = cursors.at(-1) ?? null;

  useLayoutEffect(() => {
    if (!isActive) {
      pendingLatestFocus.current = false;
    }
  }, [isActive]);

  const focusLatestViewport = useCallback(
    (viewport: HTMLDivElement) => {
      if (!pendingLatestFocus.current || !isActive || !viewport.isConnected) {
        return;
      }

      if (!viewport.checkVisibility({ visibilityProperty: true })) {
        return;
      }

      pendingLatestFocus.current = false;

      viewport.focus({ preventScroll: true });
    },
    [isActive],
  );

  return (
    <ResourceView state={state} placeholder={<ConversationPlaceholder />} label="Loading conversation">
      {(page, notice) => (
        <ConversationPage
          key={before ?? 'latest'}
          data={data}
          request={request}
          mech={mech}
          page={page}
          isLatest={before === null}
          onViewportReady={before === null ? focusLatestViewport : undefined}
          notice={
            <>
              {notice}
              <PageLoadNotice failure={failure} />
            </>
          }
          pending={pending}
          earlier={(visible) => {
            const first = visible.events[0];

            if (first !== undefined) {
              setCursors([...cursors, first.sequence]);
            }
          }}
          recent={() => {
            pendingLatestFocus.current = true;

            setCursors([]);
          }}
        />
      )}
    </ResourceView>
  );
}

function ConversationPage({
  data,
  request,
  mech,
  page,
  isLatest,
  onViewportReady,
  notice,
  earlier,
  recent,
  pending,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'events'>;
  readonly mech: Mech;
  readonly page: EventPage;
  readonly isLatest: boolean;
  readonly onViewportReady: ((viewport: HTMLDivElement) => void) | undefined;
  readonly notice: ReactNode;
  readonly earlier: (page: EventPage) => void;
  readonly recent: () => void;
  readonly pending: 'previous' | 'next' | undefined;
}): ReactNode {
  const currentWindow = useMemo(() => eventWindow(page), [page]);
  const [shown, setShown] = useState(currentWindow);
  const { appearance } = useMechAppearance(mech.id);
  const viewport = useRef<HTMLDivElement>(null);
  const reader = useReaderPosition(data.scope, request.id);

  if (
    !sameEventWindow(currentWindow, shown) &&
    (currentWindow.sequences[0] === shown.sequences[0] || shown.sequences.length === 0)
  ) {
    setShown(currentWindow);
  }

  const visibleWindow = isLatest ? shown : currentWindow;
  const lastShown = visibleWindow.sequences.at(-1);
  const hasShifted = isLatest && currentWindow.sequences.at(-1) !== lastShown;
  const hasUpdates = !isLatest || hasShifted;
  const visibleRequest = hasShifted && lastShown !== undefined ? data.reads.events(mech.id, lastShown + 1) : request;
  const visibleState = useEventWindow(data, visibleRequest, visibleWindow);
  const isWindowReady = visibleState.kind === 'ready';

  useLayoutEffect(() => {
    if (viewport.current !== null) {
      onViewportReady?.(viewport.current);
    }
  }, [isWindowReady, onViewportReady]);

  return (
    <ResourceView state={visibleState} placeholder={<ConversationPlaceholder />} label="Loading conversation">
      {(visible, windowNotice) => (
        <MechConversation
          name={mech.name}
          avatar={<AgentAvatar seed={mech.id} appearance={appearance} />}
          page={visible}
          viewportRef={viewport}
          scrollRestorationId={reader.id}
          initialPosition={reader.position}
          inspect={(turn) => (
            <MessageAction
              label="Open run"
              kind="link"
              render={<ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn }} row={turn} />}
            >
              <ScanLine size={16} aria-hidden />
            </MessageAction>
          )}
          sourceLink={(mechId) => (
            <ConsoleLink to={{ workspace: data.workspace.id, mech: mechId }}>Source mech</ConsoleLink>
          )}
          controls={
            <>
              {notice}
              {visibleRequest.id !== request.id && windowNotice}
              {visible.hasMore && (
                <Button
                  variant="ghost"
                  isPending={pending === 'next'}
                  pendingLabel="Loading earlier messages…"
                  disabled={pending !== undefined}
                  onClick={() => earlier(visible)}
                >
                  Earlier messages
                </Button>
              )}
            </>
          }
          updates={
            hasUpdates ? (
              isLatest ? (
                <Conversation.LatestButton label="Show new messages" onActivate={() => setShown(currentWindow)} />
              ) : (
                <Button
                  isPending={pending === 'previous'}
                  pendingLabel="Loading latest messages…"
                  disabled={pending !== undefined}
                  onClick={recent}
                >
                  Return to latest
                </Button>
              )
            ) : undefined
          }
        />
      )}
    </ResourceView>
  );
}
