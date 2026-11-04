import {
  CopyValue,
  Details,
  Divider,
  EmptyState,
  Heading,
  Inspector,
  Metric,
  MetricGrid,
  Muted,
  Notice,
  Prose,
  Row,
  Stack,
  Subheading,
  Tabs,
  TextButton,
} from '@mechane-ai/ui';
import type { Trace } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel, preciseTimeLabel, timeLabel } from './format.ts';
import { RequestWaterfall } from './request-waterfall.tsx';
import { traceEvidence } from './trace-evidence.ts';
import { TraceRequest } from './trace-request.tsx';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

export type TraceTab = 'Overview' | 'Requests' | 'Events';

type TraceProps = {
  readonly trace: Trace;
  readonly tab: TraceTab;
  readonly onTab: (tab: TraceTab) => void;
  readonly requestId?: string | undefined;
  readonly onRequest: (id: string) => void;
  readonly requestHref: (id: string) => string;
  readonly replyLink: (sequence: number) => ReactNode;
  readonly events?: ReactNode;
};

const OVERVIEW_REQUESTS = 3;

export function TurnTrace({
  trace,
  tab,
  onTab,
  requestId,
  onRequest,
  requestHref,
  replyLink,
  events,
}: TraceProps): ReactNode {
  const evidence = traceEvidence(trace);
  const { turn, items, start, end, finished } = evidence;

  const selected =
    requestId === undefined ? trace.dispatches[0] : trace.dispatches.find((request) => request.id === requestId);

  const count = items.length;
  const timing = { start, end, onRequest };

  return (
    <Stack>
      <Stack compact>
        <Row>
          <Muted>Turn outcome</Muted>
          {turn !== undefined && (
            <CopyValue label="start time in UTC" value={preciseTimeLabel(turn.startedAt)}>
              {timeLabel(turn.startedAt)}
            </CopyValue>
          )}
        </Row>
        <Heading>{trace.turn.status === 'running' ? 'Turn in progress' : outcomeLabel(trace.turn.status)}</Heading>
        <MetricGrid>
          {finished !== undefined && <Metric label="elapsed" value={durationLabel(finished - start)} />}
          <Metric label={count === 1 ? 'model request' : 'model requests'} value={String(count)} />
          {evidence.settled > 0 && <Metric label="settled" value={moneyLabel(evidence.cost)} />}
        </MetricGrid>
      </Stack>
      <Tabs.Root value={tab} onValueChange={onTab}>
        <Tabs.List aria-label="Turn details">
          <Tabs.Tab value="Overview">Overview</Tabs.Tab>
          <Tabs.Tab value="Requests">Requests</Tabs.Tab>
          <Tabs.Tab value="Events">Events</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="Overview">
          <TraceOverview
            trace={trace}
            evidence={evidence}
            onRequest={onRequest}
            replyLink={replyLink}
            onRequests={() => onTab('Requests')}
          />
        </Tabs.Panel>
        <Tabs.Panel value="Requests">
          <Stack compact>
            <Row between>
              <Subheading>Model requests</Subheading>
              <Muted>
                {evidence.reported > 0
                  ? `${evidence.tokens.toLocaleString()} tokens reported · ${evidence.reported} of ${count} ${count === 1 ? 'request' : 'requests'}`
                  : 'Token usage unavailable'}
              </Muted>
            </Row>
            {count === 0 ? (
              <EmptyState title="No model requests recorded">
                A request appears after the runtime checks its allowance.
              </EmptyState>
            ) : (
              <Inspector
                label="Selected request"
                master={<RequestWaterfall {...timing} items={items} selectedId={selected?.id} />}
                detail={
                  selected === undefined ? (
                    <Notice>This request is unavailable in this turn. Select a recorded request above.</Notice>
                  ) : (
                    <TraceRequest
                      request={selected}
                      number={trace.dispatches.indexOf(selected) + 1}
                      href={requestHref(selected.id)}
                    />
                  )
                }
              />
            )}
            <Muted>
              Bars measure reservation to settlement. A hollow point marks an open reservation. A diamond marks a
              refusal before a model call.
            </Muted>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="Events">{events}</Tabs.Panel>
      </Tabs.Root>
    </Stack>
  );
}

function TraceOverview({
  trace,
  evidence,
  onRequest,
  replyLink,
  onRequests,
}: Pick<TraceProps, 'trace' | 'onRequest' | 'replyLink'> & {
  readonly evidence: ReturnType<typeof traceEvidence>;
  readonly onRequests: () => void;
}): ReactNode {
  const { turn, items, start, end } = evidence;
  const count = items.length;
  const timing = { start, end, onRequest };

  return (
    <Stack>
      <RecordedOutcome trace={trace} evidence={evidence} onRequest={onRequest} replyLink={replyLink} />
      {count > 0 && (
        <Stack compact>
          <Row between>
            <Subheading>Request timing</Subheading>
            <TextButton onClick={onRequests}>View requests →</TextButton>
          </Row>
          <RequestWaterfall {...timing} items={items.slice(0, OVERVIEW_REQUESTS)} selectedId={undefined} />
          {count > OVERVIEW_REQUESTS && (
            <Muted>
              First {OVERVIEW_REQUESTS} of {count} recorded requests.
            </Muted>
          )}
          <Muted>Timing runs from allowance reservation to settlement.</Muted>
        </Stack>
      )}
      <Divider />
      <Details
        items={[
          { label: 'Turn ID', value: <CopyValue label="turn ID" value={trace.turn.id} /> },
          ...(turn === undefined
            ? []
            : [
                { label: 'Definition', value: `Revision ${turn.definitionRevision}` },
                { label: 'Inputs', value: String(turn.inboxItemIds.length) },
              ]),
        ]}
      />
    </Stack>
  );
}

function RecordedOutcome({
  trace,
  evidence,
  onRequest,
  replyLink,
}: Pick<TraceProps, 'trace' | 'onRequest' | 'replyLink'> & {
  readonly evidence: ReturnType<typeof traceEvidence>;
}): ReactNode {
  const { turn, items } = evidence;
  const reply = Option.getOrUndefined(trace.replyExcerpt);
  const refused = items.find((item) => item.status === 'refused');
  const latest = items.at(-1);

  return (
    <Stack compact>
      <Subheading>
        {trace.turn.status === 'answered'
          ? 'Recorded reply'
          : trace.turn.status === 'unanswered'
            ? 'Outcome'
            : 'Latest evidence'}
      </Subheading>
      {turn?.status === 'answered' &&
        (reply === undefined ? (
          <Muted>The recorded reply is unavailable in this format. Open Events to inspect the history.</Muted>
        ) : (
          <>
            <Prose>
              {reply.text}
              {reply.isTruncated ? '…' : ''}
            </Prose>
            <Row>{replyLink(reply.sequence)}</Row>
          </>
        ))}
      {turn?.status === 'unanswered' && (
        <>
          <Prose>{outcomeReason(turn.reason)}</Prose>
          {refused !== undefined && (
            <Row>
              <TextButton onClick={() => onRequest(refused.id)}>
                Inspect refused {refused.label.toLowerCase()} →
              </TextButton>
            </Row>
          )}
        </>
      )}
      {turn?.status === 'running' && (
        <Prose>
          {latest === undefined
            ? 'This turn has started. Its first model request has not been recorded yet.'
            : `Most recent model request: ${latest.summary}.`}
        </Prose>
      )}
      {turn === undefined && <Muted>This turn uses a newer record format.</Muted>}
    </Stack>
  );
}
