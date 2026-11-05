import { CopyValue, Divider, Muted, Prose, Row, Stack, Subheading, TextButton } from '@mechane-ai/elements';
import { Details, Inspector, Metric, MetricGrid } from '@mechane-ai/elements/collections';
import { Trace as RequestTrace } from '@mechane-ai/elements/content';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { Tabs } from '@mechane-ai/elements/navigation';
import { colors, typography } from '@mechane-ai/elements/tokens.stylex';
import type { Trace } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel, preciseTimeLabel, timeLabel } from './format.ts';
import { RequestWaterfall } from './request-waterfall.tsx';
import { traceEvidence } from './trace-evidence.ts';
import { TraceRequest } from './trace-request.tsx';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

const styles = stylex.create({
  replyPreview: {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 4,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
    maxWidth: '72ch',
    margin: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
});

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
  const timing = { start, end, onRequest };

  return (
    <Stack>
      <Stack compact>
        <Row>
          <Muted>Execution</Muted>
          {turn !== undefined && (
            <CopyValue label="start time in UTC" value={preciseTimeLabel(turn.startedAt)}>
              {timeLabel(turn.startedAt)}
            </CopyValue>
          )}
        </Row>
        <Subheading>{trace.turn.status === 'running' ? 'Running' : outcomeLabel(trace.turn.status)}</Subheading>
        {turn?.inputExcerpt !== undefined && turn.inputExcerpt.length > 0 && <Prose>{turn.inputExcerpt}</Prose>}
        <MetricGrid>
          {finished !== undefined && <Metric label="elapsed" value={durationLabel(finished - start)} />}
          <Metric label={count === 1 ? 'model request' : 'model requests'} value={String(count)} />
          {evidence.settled > 0 && <Metric label="settled" value={moneyLabel(evidence.cost)} />}
        </MetricGrid>
      </Stack>
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
          />
        </Tabs.Panel>
        <Tabs.Panel value="Requests">
          <Stack compact>
            <Row between>
              <Subheading>Model requests</Subheading>
              <Muted>
                {evidence.reported > 0
                  ? `${evidence.tokens.toLocaleString('en-US')} tokens reported · ${evidence.reported} of ${count} ${count === 1 ? 'request' : 'requests'}`
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
        <Tabs.Panel value="Tools">
          <Stack compact>
            {(trace.evidenceNotices ?? []).map((message) => (
              <Notice key={message}>{message}</Notice>
            ))}
            {(trace.toolCalls ?? []).length === 0 ? (
              <EmptyState title="No tool steps recorded">
                This execution has no retained tool calls in the inspected transcript. Model requests and original
                messages are available in the other views.
              </EmptyState>
            ) : (
              <RequestTrace.Root label="Recorded tool steps">
                {trace.toolCalls?.map((call) => (
                  <RequestTrace.Item
                    key={call.id}
                    id={call.id}
                    label={call.name}
                    description={Option.isSome(call.endedAt) ? timeLabel(call.endedAt.value) : 'No committed result'}
                    status={call.status === 'completed' ? 'complete' : call.status === 'failed' ? 'failed' : 'unknown'}
                    statusLabel={call.status}
                  />
                ))}
              </RequestTrace.Root>
            )}
            <Muted>
              Tool names, outcomes, and recorded times are shown. Raw arguments and outputs are kept out of the console
              because they can contain credentials.
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
  const { turn, items } = evidence;
  const count = items.length;

  return (
    <Stack>
      <RecordedOutcome trace={trace} evidence={evidence} onRequest={onRequest} replyLink={replyLink} />
      {count > 0 && (
        <Stack compact>
          <Row between>
            <Subheading>Recorded requests</Subheading>
            <TextButton onClick={onRequests}>View requests →</TextButton>
          </Row>
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
          {count > OVERVIEW_REQUESTS && (
            <Muted>
              First {OVERVIEW_REQUESTS} of {count} recorded requests.
            </Muted>
          )}
          <Muted>Open a request to inspect its reservation-to-settlement timing and recorded usage.</Muted>
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
          ? 'Reply preview'
          : trace.turn.status === 'unanswered'
            ? 'Outcome'
            : 'Latest evidence'}
      </Subheading>
      {turn?.status === 'answered' &&
        (reply === undefined ? (
          <Muted>The recorded reply is unavailable in this format. Open Events to inspect the history.</Muted>
        ) : (
          <>
            <p {...stylex.props(styles.replyPreview)}>
              {reply.text}
              {reply.isTruncated ? '…' : ''}
            </p>
            <Row>
              {replyLink(reply.sequence)}
              {reply.isTruncated && <Muted>Reply continues</Muted>}
            </Row>
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
