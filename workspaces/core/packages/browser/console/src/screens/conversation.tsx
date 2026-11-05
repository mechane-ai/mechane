import { Button, Muted, Row, Status } from '@mechane-ai/elements';
import type { ConsoleData } from '@mechane/console-data';
import { MechConversation } from '@mechane/console-views';
import type { EventPage, Mech } from '@mechane/protocol';
import { Option } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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

  if (page !== shown && (page.events[0]?.sequence === shown.events[0]?.sequence || shown.events.length === 0)) {
    setShown(page);
  }

  const visible = latest ? shown : page;
  const shifted = latest && page.events.at(-1)?.sequence !== visible.events.at(-1)?.sequence;

  return (
    <MechConversation
      name={mech.name}
      page={visible}
      inspect={(turn) => (
        <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id, turn }} row={turn}>
          Inspect run →
        </ConsoleLink>
      )}
      sourceLink={(mechId) => (
        <ConsoleLink to={{ workspace: data.workspace.id, mech: mechId }}>Open source mech →</ConsoleLink>
      )}
      controls={
        <>
          {notice}
          <CurrentRun data={data} mech={mech} />
          <Row between>
            <Muted>{latest ? 'One continuous conversation' : 'Earlier conversation'}</Muted>
            <Row>
              {visible.hasMore && (
                <Button size="sm" onClick={() => earlier(visible)}>
                  Earlier messages
                </Button>
              )}
              {!latest && (
                <Button size="sm" onClick={recent}>
                  Latest messages
                </Button>
              )}
              {shifted && (
                <Button size="sm" onClick={() => setShown(page)}>
                  Show new messages
                </Button>
              )}
            </Row>
          </Row>
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
        Inspect current run →
      </ConsoleLink>
    </Row>
  );
}
