import { Button, Row, Stack } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import { TurnTrace, TurnTracePlaceholder } from '@mechane/console-views';
import type { TraceTab } from '@mechane/console-views';
import type { ConsoleView, Mech, Turn } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { useRouter } from '@tanstack/react-router';
import { Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { Resource } from '../resource.tsx';
import type { ConsoleLocation, ConsoleNavigation } from '../types.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { TurnHistory } from './turn-history.tsx';

const inspectorViews: ReadonlySet<ConsoleView> = new Set(['requests', 'events', 'tools']);

type TraceScreenProps = ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly notice: ReactNode;
  readonly source: ReturnType<ConsoleData['trace']>;
};

export function selectedTraceTab(location: ConsoleLocation): TraceTab {
  const inspect = location.inspect ?? location.view;

  return inspect === 'requests'
    ? 'Requests'
    : inspect === 'events'
      ? 'Events'
      : inspect === 'tools'
        ? 'Tools'
        : 'Overview';
}

export function TraceScreen({ turnId, ...props }: TraceScreenProps & { readonly turnId: string }): ReactNode {
  if (!Schema.is(TurnId)(turnId)) {
    return (
      <Notice error>
        This run ID is invalid.{' '}
        <Button onClick={() => props.navigate({ workspace: props.data.workspace.id, mech: props.mech.id })}>
          Return to mech
        </Button>
      </Notice>
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
  source,
}: TraceScreenProps & { readonly turnId: Turn['id'] }): ReactNode {
  const router = useRouter();
  const [cancelState, setCancelState] = useState<'idle' | 'sending' | 'received'>('idle');
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();

  const mainView = inspectorViews.has(location.view ?? 'conversation') ? 'conversation' : location.view;

  const base = { workspace: data.workspace.id, mech: mech.id, ...(mainView === undefined ? {} : { view: mainView }) };
  const selected = { ...base, turn: turnId };
  const tab = selectedTraceTab(location);

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
    <Stack>
      {notice}
      <Resource
        data={data}
        source={source}
        placeholder={<TurnTracePlaceholder tab={tab} />}
        label="Loading execution evidence"
      >
        {(trace, traceNotice) => (
          <Stack>
            {traceNotice}
            {error !== undefined && <Notice error>{error}</Notice>}
            {trace.turn.status === 'running' && (
              <Row>
                <Button
                  disabled={cancelState !== 'idle'}
                  pending={cancelState === 'sending'}
                  pendingLabel="Requesting…"
                  onClick={cancel}
                >
                  {cancelState === 'received' ? 'Cancellation requested' : 'Cancel run'}
                </Button>
              </Row>
            )}
            {cancelState === 'received' && trace.turn.status === 'running' && (
              <Notice>Waiting for the execution to stop.</Notice>
            )}
            <TurnTrace
              trace={trace}
              tab={tab}
              requestId={location.request}
              onTab={(next) =>
                navigate({
                  ...selected,
                  inspect:
                    next === 'Requests'
                      ? 'requests'
                      : next === 'Events'
                        ? 'events'
                        : next === 'Tools'
                          ? 'tools'
                          : 'conversation',
                })
              }
              onRequest={(request) => navigate({ ...selected, inspect: 'requests', request })}
              requestHref={(request) =>
                new URL(
                  router.buildLocation({ to: '/', search: { ...selected, inspect: 'requests', request } }).publicHref,
                  globalThis.location.origin,
                ).href
              }
              replyLink={(sequence) => (
                <ConsoleLink to={{ ...selected, inspect: 'events', event: sequence }}>Read full reply</ConsoleLink>
              )}
              events={
                tab === 'Events' && (
                  <TurnHistory
                    key={location.event ?? 'start'}
                    data={data}
                    mechId={mech.id}
                    turnId={turnId}
                    target={location.event}
                    onStart={() => navigate({ ...selected, inspect: 'events' })}
                  />
                )
              }
            />
          </Stack>
        )}
      </Resource>
    </Stack>
  );
}
