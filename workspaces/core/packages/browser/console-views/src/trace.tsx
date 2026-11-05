import {
  Collapsible,
  CopyValue,
  Divider,
  Muted,
  Prose,
  Row,
  Stack,
  Status,
  Subheading,
  TextButton,
} from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Trace as RequestTrace } from '@mechane-ai/elements/content';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { Tabs } from '@mechane-ai/elements/navigation';
import type { Trace } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';
import { RequestWaterfall } from './request-waterfall.tsx';
import { traceEvidence } from './trace-evidence.ts';
import { TraceRequest } from './trace-request.tsx';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

export type TraceTab = 'Overview' | 'Requests' | 'Tools' | 'Events';

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
const SHORT_INPUT_LENGTH = 240;

const requestTraceStatuses = {
  reserved: 'pending',
  refused: 'failed',
  settled: 'complete',
  unavailable: 'unknown',
} as const;

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

  return (
    <Stack compact>
      <Row between>
        <Row>
          <Status
            tone={
              trace.turn.status === 'answered'
                ? 'positive'
                : trace.turn.status === 'unanswered'
                  ? 'negative'
                  : 'neutral'
            }
          >
            {outcomeLabel(trace.turn.status)}
          </Status>
          {turn !== undefined && <ConsoleTimestamp value={turn.startedAt} />}
          {finished !== undefined && <Muted>{durationLabel(finished - start)}</Muted>}
        </Row>
        {evidence.settled > 0 && <Muted>{moneyLabel(evidence.cost)} settled</Muted>}
      </Row>
      <Tabs.Root value={tab} onValueChange={onTab}>
        <Tabs.List aria-label="Run details">
          <Tabs.Tab value="Overview">Overview</Tabs.Tab>
          <Tabs.Tab value="Requests">Requests</Tabs.Tab>
          <Tabs.Tab value="Tools">Tools</Tabs.Tab>
          <Tabs.Tab value="Events">Events</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="Overview">
          <TraceOverview
            trace={trace}
            evidence={evidence}
            onRequest={onRequest}
            replyLink={replyLink}
            onRequests={() => onTab('Requests')}
            onEvents={() => onTab('Events')}
          />
        </Tabs.Panel>
        <Tabs.Panel value="Requests">
          <Stack>
            <Row between>
              <Subheading>{count === 1 ? '1 recorded request' : `${count} recorded requests`}</Subheading>
              {count > 0 && (
                <Muted>
                  {evidence.reported > 0
                    ? `${evidence.tokens.toLocaleString('en-US')} tokens reported${evidence.reported < count ? ` · ${evidence.reported}/${count} requests` : ''}`
                    : 'Token usage unavailable'}
                </Muted>
              )}
            </Row>
            {count === 0 ? (
              <EmptyState title="No model requests recorded" />
            ) : (
              <>
                <RequestWaterfall
                  start={start}
                  end={end}
                  onRequest={onRequest}
                  items={items}
                  selectedId={selected?.id}
                />
                <Muted>Reservation to settlement</Muted>
                <Divider />
                {selected === undefined ? (
                  <Notice>This request is unavailable in this run. Select a recorded request above.</Notice>
                ) : (
                  <TraceRequest
                    request={selected}
                    number={trace.dispatches.indexOf(selected) + 1}
                    href={requestHref(selected.id)}
                  />
                )}
              </>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="Tools">
          <TraceTools trace={trace} />
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
  onEvents,
}: Pick<TraceProps, 'trace' | 'onRequest' | 'replyLink'> & {
  readonly evidence: ReturnType<typeof traceEvidence>;
  readonly onRequests: () => void;
  readonly onEvents: () => void;
}): ReactNode {
  const { turn, items } = evidence;
  const count = items.length;

  return (
    <Stack>
      {turn?.inputExcerpt !== undefined && turn.inputExcerpt.length > 0 && (
        <Collapsible.Root defaultOpen={turn.inputExcerpt.length <= SHORT_INPUT_LENGTH}>
          <Collapsible.Trigger>Input</Collapsible.Trigger>
          <Collapsible.Panel>
            <Stack compact>
              <Prose>{turn.inputExcerpt}</Prose>
              <Row>
                <TextButton onClick={onEvents}>View original messages</TextButton>
              </Row>
            </Stack>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
      <RecordedOutcome trace={trace} evidence={evidence} onRequest={onRequest} replyLink={replyLink} />
      {count > 0 && (
        <Collapsible.Root>
          <Collapsible.Trigger>{count === 1 ? '1 model request' : `${count} model requests`}</Collapsible.Trigger>
          <Collapsible.Panel>
            <Stack compact>
              <RequestTrace.Root label="Recorded model requests">
                {items.slice(0, OVERVIEW_REQUESTS).map((item) => (
                  <RequestTrace.Item
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    description={item.detail}
                    status={requestTraceStatuses[item.status]}
                    statusLabel={item.summary}
                    selected={false}
                    onSelect={onRequest}
                  />
                ))}
              </RequestTrace.Root>
              <Row>
                <TextButton onClick={onRequests}>View all requests</TextButton>
              </Row>
            </Stack>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
      <Collapsible.Root>
        <Collapsible.Trigger>Run metadata</Collapsible.Trigger>
        <Collapsible.Panel>
          <Details
            items={[
              { label: 'Run ID', value: <CopyValue label="run ID" value={trace.turn.id} /> },
              ...(turn === undefined
                ? []
                : [
                    { label: 'Definition', value: `Revision ${turn.definitionRevision}` },
                    { label: 'Inputs', value: String(turn.inboxItemIds.length) },
                  ]),
            ]}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </Stack>
  );
}

function TraceTools({ trace }: { readonly trace: Trace }): ReactNode {
  return (
    <Stack compact>
      {(trace.evidenceNotices ?? []).map((message) => (
        <Notice key={message}>{message}</Notice>
      ))}
      {trace.toolCalls === undefined ? (
        <Notice>Tool evidence is unavailable for this run.</Notice>
      ) : trace.toolCalls.length === 0 ? (
        <EmptyState title="No tool steps recorded" />
      ) : (
        <RequestTrace.Root label="Recorded tool steps">
          {trace.toolCalls.map((call) => (
            <RequestTrace.Item
              key={call.id}
              id={call.id}
              label={call.name}
              description={Option.isSome(call.endedAt) ? 'Result recorded' : 'No committed result'}
              status={call.status === 'completed' ? 'complete' : call.status === 'failed' ? 'failed' : 'unknown'}
              statusLabel={call.status}
              detail={Option.isSome(call.endedAt) ? <ConsoleTimestamp value={call.endedAt.value} /> : undefined}
            />
          ))}
        </RequestTrace.Root>
      )}
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
          ? 'Reply'
          : trace.turn.status === 'unanswered'
            ? 'Outcome'
            : 'Latest activity'}
      </Subheading>
      {turn?.status === 'answered' &&
        (reply === undefined ? (
          <Muted>The recorded reply is unavailable in this format. Open Events to inspect the history.</Muted>
        ) : (
          <>
            <Markdown>{reply.text}</Markdown>
            {reply.isTruncated && <Row>{replyLink(reply.sequence)}</Row>}
          </>
        ))}
      {turn?.status === 'unanswered' && (
        <>
          <Prose>{outcomeReason(turn.reason)}</Prose>
          {refused !== undefined && (
            <Row>
              <TextButton onClick={() => onRequest(refused.id)}>Inspect refused request</TextButton>
            </Row>
          )}
        </>
      )}
      {turn?.status === 'running' && (
        <Prose>
          {latest === undefined ? 'Waiting for the first recorded request.' : `Most recent request: ${latest.summary}.`}
        </Prose>
      )}
      {turn === undefined && <Muted>This run uses a newer record format.</Muted>}
    </Stack>
  );
}
