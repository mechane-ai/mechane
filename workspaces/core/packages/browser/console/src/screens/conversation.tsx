import { AgentAvatar, Button, Row, Status } from '@mechane-ai/elements';
import { MessageAction } from '@mechane-ai/elements/ai';
import type { ConsoleData } from '@mechane/console-data';
import { MechConversation } from '@mechane/console-views';
import type { EventPage, Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { ScanLine } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from '../mech-appearance.tsx';
import { ConsoleLink, usePageCursors } from '../navigation.tsx';
import { Resource, useResource } from '../resource.tsx';

export function ConversationScreen({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const [cursors, setCursors] = usePageCursors('conversation', []);
  const before = cursors.at(-1) ?? null;
  const source = useMemo(() => data.events(mech.id, before), [data, mech.id, before]);

  return (
    <Resource data={data} source={source} label="Loading conversation">
      {(page, notice) => (
        <ConversationPage
          key={before ?? 'latest'}
          data={data}
          mech={mech}
          page={page}
          latest={before === null}
          notice={notice}
          earlier={(visible) => {
            const first = visible.events[0];

            if (first !== undefined) {
              setCursors([...cursors, first.sequence]);
            }
          }}
          recent={() => setCursors([])}
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
  notice,
  earlier,
  recent,
}: {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly page: EventPage;
  readonly latest: boolean;
  readonly notice: ReactNode;
  readonly earlier: (page: EventPage) => void;
  readonly recent: () => void;
}): ReactNode {
  const [shown, setShown] = useState(page);
  const { appearance } = useMechAppearance(mech.id);

  if (page !== shown && (page.events[0]?.sequence === shown.events[0]?.sequence || shown.events.length === 0)) {
    setShown(page);
  }

  const visible = latest ? shown : page;
  const shifted = latest && page.events.at(-1)?.sequence !== visible.events.at(-1)?.sequence;
  const hasHistoryActions = visible.hasMore || !latest || shifted;

  const historyActions = (
    <Row>
      {visible.hasMore && (
        <Button variant="ghost" size="sm" onClick={() => earlier(visible)}>
          Earlier messages
        </Button>
      )}
      {!latest && (
        <Button variant="ghost" size="sm" onClick={recent}>
          Latest messages
        </Button>
      )}
      {shifted && (
        <Button variant="ghost" size="sm" onClick={() => setShown(page)}>
          Show new messages
        </Button>
      )}
    </Row>
  );

  return (
    <MechConversation
      name={mech.name}
      avatar={<AgentAvatar seed={mech.id} appearance={appearance} size="sm" />}
      page={visible}
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
          <CurrentRun data={data} mech={mech} />
          {hasHistoryActions && historyActions}
        </>
      }
    />
  );
}

function CurrentRun({ data, mech }: { readonly data: ConsoleData; readonly mech: Mech }): ReactNode {
  const source = useMemo(() => data.turns(mech.id, Option.none()), [data, mech.id]);
  const state = useResource(data, source);

  switch (state.kind) {
    case 'pending':
    case 'failed':
      return null;
    case 'ready':
    case 'stale':
      break;
  }

  const running = state.value.turns.find((turn) => turn.status === 'running');

  if (running === undefined) {
    return null;
  }

  return (
    <Row>
      <Status tone="neutral">{state.kind === 'stale' ? 'Last seen running · refresh unavailable' : 'Running'}</Status>
      <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn: running.id }} row={running.id}>
        Open run
      </ConsoleLink>
    </Row>
  );
}
