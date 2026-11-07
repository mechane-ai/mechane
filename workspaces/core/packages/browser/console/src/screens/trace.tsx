import { Button, Row, Stack } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { TurnTrace, TurnTracePlaceholder } from '@mechane/console-views';
import type { TraceTab } from '@mechane/console-views';
import type { ConsoleView, Mech, Turn } from '@mechane/protocol';
import { MechId, TurnId } from '@mechane/records';
import { useRouter } from '@tanstack/react-router';
import { Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleLink } from '../navigation.tsx';
import { useTrace } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ConsoleLocation, ConsoleNavigation } from '../types.ts';
import { useScreenLifetime } from '../use-screen-lifetime.ts';
import { TurnHistory } from './turn-history.tsx';

const inspectorViews: ReadonlySet<ConsoleView> = new Set(['requests', 'events', 'tools']);
const cancelableStatuses: ReadonlySet<string> = new Set(['queued', 'running', 'waiting']);

type TraceScreenProps = ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly mech: Mech;
  readonly notice: ReactNode;
  readonly request: ReadRequest<'trace'>;
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
      <Notice hasError>
        This run ID is invalid.{' '}
        <Button
          onClick={() =>
            props.navigate({
              workspace: props.data.workspace.id,
              mech: props.mech.id,
              ...(props.location.session === undefined ? {} : { session: props.location.session }),
            })
          }
        >
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
  request,
}: TraceScreenProps & { readonly turnId: Turn['id'] }): ReactNode {
  const router = useRouter();
  const [cancelState, setCancelState] = useState<'idle' | 'sending' | 'received'>('idle');
  const [error, setError] = useState<string>();
  const isScreenActive = useScreenLifetime();
  const state = useTrace(data, request);

  const mainView = inspectorViews.has(location.view ?? 'conversation') ? 'conversation' : location.view;

  const base = {
    workspace: data.workspace.id,
    mech: mech.id,
    ...(location.session === undefined ? {} : { session: location.session }),
    ...(mainView === undefined ? {} : { view: mainView }),
  };

  const selected = { ...base, turn: turnId };
  const tab = selectedTraceTab(location);

  function cancel(): void {
    if (cancelState !== 'idle') {
      return;
    }

    setCancelState('sending');
    setError(undefined);
    void data.commands.cancelTurn({ mechId: MechId.make(mech.id), turnId }).then(
      () => {
        if (isScreenActive()) {
          setCancelState('received');
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
      <ResourceView state={state} placeholder={<TurnTracePlaceholder tab={tab} />} label="Loading execution evidence">
        {(trace, traceNotice) => (
          <Stack>
            {traceNotice}
            {error !== undefined && <Notice hasError>{error}</Notice>}
            {cancelableStatuses.has(trace.turn.status) && (
              <Row>
                <Button
                  disabled={cancelState !== 'idle'}
                  isPending={cancelState === 'sending'}
                  pendingLabel="Requesting…"
                  onClick={cancel}
                >
                  {cancelState === 'received' ? 'Cancellation requested' : 'Cancel run'}
                </Button>
              </Row>
            )}
            {cancelState === 'received' && cancelableStatuses.has(trace.turn.status) && (
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
              onRequest={(requestId) => navigate({ ...selected, inspect: 'requests', request: requestId })}
              requestHref={(requestId) =>
                new URL(
                  router.buildLocation({ to: '/', search: { ...selected, inspect: 'requests', request: requestId } })
                    .publicHref,
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
      </ResourceView>
    </Stack>
  );
}
