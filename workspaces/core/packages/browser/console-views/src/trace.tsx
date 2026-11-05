import { Collapsible, CopyValue, Muted, Prose, Row, Stack, Status, Subheading, TextButton } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Trace as RequestTrace } from '@mechane-ai/elements/content';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { Notice } from '@mechane-ai/elements/feedback';
import { Tabs } from '@mechane-ai/elements/navigation';
import type { Trace } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';
import { runLabel } from './run-label.ts';
import { traceEvidence } from './trace-evidence.ts';
import { TraceRequests } from './trace-requests.tsx';
import { TraceTools } from './trace-tools.tsx';
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

const styles = stylex.create({
  reading: { maxWidth: '76ch', minWidth: 0 },
  title: { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' },
});

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
  const { turn, start, finished } = evidence;

  return (
    <Stack compact>
      <Subheading title={runLabel(trace.turn)} {...stylex.props(styles.title)}>
        {runLabel(trace.turn)}
      </Subheading>
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
          {evidence.usageLabel !== undefined && <Muted>{evidence.usageLabel}</Muted>}
        </Row>
        {evidence.settled > 0 && <Muted>{moneyLabel(evidence.cost)} settled</Muted>}
      </Row>
      {evidence.notices.map((message) => (
        <Notice key={message}>{message}</Notice>
      ))}
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
          <TraceRequests
            trace={trace}
            evidence={evidence}
            requestId={requestId}
            onRequest={onRequest}
            requestHref={requestHref}
          />
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
    <div {...stylex.props(styles.reading)}>
      <Stack>
        <RecordedOutcome trace={trace} evidence={evidence} onRequest={onRequest} replyLink={replyLink} />
        {turn?.inputExcerpt !== undefined && turn.inputExcerpt.length > 0 && (
          <Collapsible.Root>
            <Collapsible.Trigger>Input preview</Collapsible.Trigger>
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
    </div>
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
  const replyLabel = reply?.isTruncated === true ? 'Reply preview' : 'Reply';
  const refused = items.find((item) => item.status === 'refused');
  const latest = items.at(-1);

  return (
    <Stack compact>
      <Subheading>
        {trace.turn.status === 'answered'
          ? replyLabel
          : trace.turn.status === 'unanswered'
            ? 'Outcome'
            : 'Latest activity'}
      </Subheading>
      {turn?.status === 'answered' &&
        (reply === undefined ? (
          <Muted>The recorded reply is unavailable in this format. Open Events to inspect the history.</Muted>
        ) : (
          <>
            <Markdown headingLevel={3}>{reply.text}</Markdown>
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
