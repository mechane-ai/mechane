import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { TurnTrace } from '@mechane/console-views';
import type { TraceTab } from '@mechane/console-views';
import type { Mech, Turn } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { Notice, Stack } from '@mechane/ui';
import { DetailPage, PageToolbar, ToolbarAction } from '@mechane/ui/layout';
import { useRouter } from '@tanstack/react-router';
import { Schema } from 'effect';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ConsoleNavigation } from '../types.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { TurnHistory } from './turn-history.tsx';

type TraceScreenProps = ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly notice: ReactNode;
};

export function TraceScreen({ turnId, ...props }: TraceScreenProps & { readonly turnId: string }): ReactNode {
  if (!Schema.is(TurnId)(turnId)) {
    return (
      <>
        <PageToolbar title="Turn trace" />
        {props.notice}
        <DetailPage>
          <Notice error>This turn ID is invalid.</Notice>
        </DetailPage>
      </>
    );
  }

  return <ValidTraceScreen {...props} turnId={turnId} />;
}

function ValidTraceScreen({
  data,
  mech,
  turnId,
  location,
  navigate,
  notice,
}: TraceScreenProps & { readonly turnId: Turn['id'] }): ReactNode {
  const router = useRouter();
  const source = useMemo(() => data.trace(mech.id, turnId), [data, mech.id, turnId]);
  const [cancelState, setCancelState] = useState<'idle' | 'sending' | 'received'>('idle');
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();
  const base = { workspace: data.workspace.id, mech: mech.id, turn: turnId };
  const tab: TraceTab = location.view === 'requests' ? 'Requests' : location.view === 'events' ? 'Events' : 'Overview';

  const title = (
    <>
      <ConsoleLink to={{ workspace: data.workspace.id, mech: mech.id }}>{mech.name} / Turns</ConsoleLink> / Turn trace
    </>
  );

  function cancel(): void {
    if (cancelState !== 'idle') {
      return;
    }

    setCancelState('sending');
    setError(undefined);
    void data.api('cancelTurn', { workspaceId: data.workspace.id, mechId: mech.id, turnId }).then(
      () => {
        if (isScreenActive()) {
          setCancelState('received');
          void source.utils.refetch();
        }
      },
      (cause: unknown) => {
        if (isScreenActive()) {
          setCancelState('idle');
          setError(problemMessage(cause));
        }
      },
    );
  }

  return (
    <Resource
      data={data}
      source={source}
      fallbackHeader={<PageToolbar breadcrumb title={title} />}
      label="Loading turn"
    >
      {(trace, traceNotice) => (
        <>
          <PageToolbar
            breadcrumb
            title={title}
            actions={
              trace.turn.status === 'running' && (
                <ToolbarAction
                  disabled={cancelState !== 'idle'}
                  pending={cancelState === 'sending'}
                  pendingLabel="Requesting…"
                  onClick={cancel}
                >
                  {cancelState === 'received' ? 'Cancellation requested' : 'Cancel turn'}
                </ToolbarAction>
              )
            }
          />
          {notice}
          {traceNotice}
          <DetailPage>
            <Stack>
              {error !== undefined && <Notice error>{error}</Notice>}
              {cancelState === 'received' && trace.turn.status === 'running' && (
                <Notice>Cancellation requested. Waiting for the turn to stop.</Notice>
              )}
              <TurnTrace
                trace={trace}
                tab={tab}
                requestId={location.request}
                onTab={(next) =>
                  navigate(next === 'Overview' ? base : { ...base, view: next === 'Requests' ? 'requests' : 'events' })
                }
                onRequest={(request) => navigate({ ...base, view: 'requests', request })}
                requestHref={(request) =>
                  new URL(
                    router.buildLocation({ to: '/', search: { ...base, view: 'requests', request } }).publicHref,
                    globalThis.location.origin,
                  ).href
                }
                replyLink={(sequence) => (
                  <ConsoleLink to={{ ...base, view: 'events', event: sequence }}>Read full reply →</ConsoleLink>
                )}
                events={
                  tab === 'Events' && (
                    <TurnHistory
                      key={location.event ?? 'start'}
                      data={data}
                      mechId={mech.id}
                      turnId={turnId}
                      target={location.event}
                      onStart={() => navigate({ ...base, view: 'events' })}
                    />
                  )
                }
              />
            </Stack>
          </DetailPage>
        </>
      )}
    </Resource>
  );
}
