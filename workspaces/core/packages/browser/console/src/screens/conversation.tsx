import { AgentAvatar, Button } from '@mechane-ai/elements';
import { Conversation, MessageAction } from '@mechane-ai/elements/ai';
import type { ConsoleData } from '@mechane/console-data';
import { ConversationPlaceholder, MechConversation } from '@mechane/console-views';
import type { EventPage, Mech } from '@mechane/protocol';
import { ScanLine } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';
import { ConsoleLink } from '../navigation.tsx';
import { PageLoadNotice } from '../page-source.tsx';
import type { PageSource } from '../page-source.tsx';
import { Resource } from '../resource.tsx';

export function ConversationScreen({
  data,
  mech,
  isActive,
  pageSource,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly isActive: boolean;
  readonly pageSource: PageSource<'conversation', ReturnType<ConsoleData['events']>>;
}): ReactNode {
  const { source, cursors, setCursors, pending, failure } = pageSource;
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
    <Resource data={data} source={source} placeholder={<ConversationPlaceholder />} label="Loading conversation">
      {(page, notice) => (
        <ConversationPage
          key={before ?? 'latest'}
          data={data}
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
    </Resource>
  );
}

function ConversationPage({
  data,
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
  readonly mech: Mech;
  readonly page: EventPage;
  readonly isLatest: boolean;
  readonly onViewportReady: ((viewport: HTMLDivElement) => void) | undefined;
  readonly notice: ReactNode;
  readonly earlier: (page: EventPage) => void;
  readonly recent: () => void;
  readonly pending: 'previous' | 'next' | undefined;
}): ReactNode {
  const [shown, setShown] = useState(page);
  const { appearance } = useMechAppearance(mech.id);
  const viewport = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (viewport.current !== null) {
      onViewportReady?.(viewport.current);
    }
  }, [onViewportReady]);

  if (page !== shown && (page.events[0]?.sequence === shown.events[0]?.sequence || shown.events.length === 0)) {
    setShown(page);
  }

  const visible = isLatest ? shown : page;
  const hasShifted = isLatest && page.events.at(-1)?.sequence !== visible.events.at(-1)?.sequence;
  const hasUpdates = !isLatest || hasShifted;

  return (
    <MechConversation
      name={mech.name}
      avatar={<AgentAvatar seed={mech.id} appearance={appearance} />}
      page={visible}
      viewportRef={viewport}
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
            <Conversation.LatestButton label="Show new messages" onActivate={() => setShown(page)} />
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
  );
}
