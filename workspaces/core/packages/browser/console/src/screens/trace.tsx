import { Stack } from '@mechane-ai/elements';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import { TurnTrace, TurnTracePlaceholder } from '@mechane/console-views';
import type { TraceTab } from '@mechane/console-views';
import type { Mech } from '@mechane/protocol';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { MechPageReads } from '../mech-page-reads.ts';
import { ConsoleLink } from '../navigation.tsx';
import { useTrace } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import type { ConsoleLocation, ConsoleNavigation } from '../types.ts';
import { RunEvidence } from './run-evidence.tsx';
import { TurnHistory } from './turn-history.tsx';

type TraceScreenProps = ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly view: MechPageReads['view'];
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

export function TraceScreen({ data, mech, location, navigate, notice, request, view }: TraceScreenProps): ReactNode {
  const router = useRouter();
  const turnId = request.turnId;
  const state = useTrace(data, request);

  const selected = { workspace: data.workspace.id, mech: mech.id, view, turn: turnId } as const;
  const tab = selectedTraceTab(location);

  return (
    <Stack>
      {notice}
      <ResourceView state={state} placeholder={<TurnTracePlaceholder tab={tab} />} label="Loading execution evidence">
        {(trace, traceNotice) => (
          <Stack>
            {traceNotice}
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
                          : 'runs',
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
                <ConsoleLink to={{ ...selected, inspect: 'events', event: sequence }}>Read full message</ConsoleLink>
              )}
              captures={<RunEvidence data={data} mechId={mech.id} turnId={turnId} />}
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
