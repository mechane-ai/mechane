import { AgentAvatar, Button } from '@mechane-ai/elements';
import { Conversation, MessageAction } from '@mechane-ai/elements/ai';
import type { ConsoleData } from '@mechane/console-data';
import { MechConversation } from '@mechane/console-views';
import type { EventPage, Mech } from '@mechane/protocol';
import { ScanLine } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';
import { ConsoleLink, usePageCursors } from '../navigation.tsx';
import { Resource } from '../resource.tsx';

export function ConversationScreen({
  data,
  mech,
  active,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly active: boolean;
}): ReactNode {
  const [cursors, setCursors] = usePageCursors('conversation', []);
  const pendingLatestFocus = useRef(false);
  const before = cursors.at(-1) ?? null;
  const source = useMemo(() => data.events(mech.id, before), [data, mech.id, before]);

  useLayoutEffect(() => {
    if (!active) {
      pendingLatestFocus.current = false;
    }
  }, [active]);

  const focusLatestViewport = useCallback(
    (viewport: HTMLDivElement) => {
      if (!pendingLatestFocus.current || !active || !viewport.isConnected) {
        return;
      }

      if (!viewport.checkVisibility({ visibilityProperty: true })) {
        return;
      }

      pendingLatestFocus.current = false;

      viewport.focus({ preventScroll: true });
    },
    [active],
  );

  return (
    <Resource data={data} source={source} label="Loading conversation">
      {(page, notice) => (
        <ConversationPage
          key={before ?? 'latest'}
          data={data}
          mech={mech}
          page={page}
          latest={before === null}
          onViewportReady={before === null ? focusLatestViewport : undefined}
          notice={notice}
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
  latest,
  onViewportReady,
  notice,
  earlier,
  recent,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly page: EventPage;
  readonly latest: boolean;
  readonly onViewportReady: ((viewport: HTMLDivElement) => void) | undefined;
  readonly notice: ReactNode;
  readonly earlier: (page: EventPage) => void;
  readonly recent: () => void;
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

  const visible = latest ? shown : page;
  const shifted = latest && page.events.at(-1)?.sequence !== visible.events.at(-1)?.sequence;
  const hasUpdates = !latest || shifted;

  return (
    <MechConversation
      name={mech.name}
      avatar={<AgentAvatar seed={mech.id} appearance={appearance} size="sm" />}
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
            <Button variant="ghost" size="sm" onClick={() => earlier(visible)}>
              Earlier messages
            </Button>
          )}
        </>
      }
      updates={
        hasUpdates ? (
          <Conversation.LatestButton
            label={latest ? 'Show new messages' : 'Return to latest'}
            onActivate={latest ? () => setShown(page) : recent}
          />
        ) : undefined
      }
    />
  );
}
