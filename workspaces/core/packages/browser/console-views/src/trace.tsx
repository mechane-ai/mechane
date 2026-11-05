import { Collapsible, CopyValue, Muted, Prose, Row, Stack, Status, Subheading, TextButton } from '@mechane-ai/elements';
import { Details, Inspector } from '@mechane-ai/elements/collections';
import { Trace as RequestTrace } from '@mechane-ai/elements/content';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { Notice, Skeleton, SkeletonText } from '@mechane-ai/elements/feedback';
import { Tabs } from '@mechane-ai/elements/navigation';
import type { Trace } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { ActivityPlaceholder } from './events.tsx';
import { durationLabel, moneyLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';
import { runLabel } from './run-label.ts';
import { traceEvidence } from './trace-evidence.ts';
import { TraceRequests } from './trace-requests.tsx';
import { TraceTools } from './trace-tools.tsx';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

const traceTabs = ['Overview', 'Requests', 'Tools', 'Events'] as const;

export type TraceTab = (typeof traceTabs)[number];

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

export function TurnTracePlaceholder({ tab = 'Overview' }: { readonly tab?: TraceTab }): ReactNode {
  return (
    <Stack compact>
      <Subheading>
        <SkeletonText width="32ch" />
      </Subheading>
      <Row>
        <SkeletonText width="10ch" />
        <SkeletonText width="16ch" />
        <SkeletonText width="6ch" />
      </Row>
      <Tabs.Root defaultValue={tab}>
        <Tabs.List aria-label="Run details">
          {traceTabs.map((value) => (
            <Tabs.Tab key={value} value={value} disabled>
              {value}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value={tab}>
          <TraceSectionPlaceholder tab={tab} />
        </Tabs.Panel>
      </Tabs.Root>
    </Stack>
  );
}

function TraceSectionPlaceholder({ tab }: { readonly tab: TraceTab }): ReactNode {
  if (tab === 'Events') {
    return <ActivityPlaceholder inset={false} />;
  }

  if (tab === 'Requests') {
    return (
      <Inspector
        label="Selected model request"
        masterLabel="Model requests"
        master={
          <Stack compact>
            <Subheading>
              <SkeletonText width="16ch" />
            </Subheading>
            <SkeletonText width="28ch" />
            <Skeleton height={180} />
          </Stack>
        }
        detail={
          <Stack>
            <Subheading>
              <SkeletonText width="18ch" />
            </Subheading>
            <SkeletonText lines={4} />
            <SkeletonText lines={3} />
          </Stack>
        }
      />
    );
  }

  if (tab === 'Tools') {
    return (
      <Stack>
        {[0, 1, 2].map((item) => (
          <Row key={item}>
            <Skeleton width={16} height={16} shape="circle" />
            <SkeletonText lines={2} width="24ch" />
          </Row>
        ))}
      </Stack>
    );
  }

  return (
    <div {...stylex.props(styles.reading)}>
      <Stack>
        <Stack compact>
          <Subheading>
            <SkeletonText width="12ch" />
          </Subheading>
          <SkeletonText lines={4} />
        </Stack>
        <SkeletonText width="18ch" />
        <SkeletonText width="16ch" />
      </Stack>
    </div>
  );
}

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
          {traceTabs.map((value) => (
            <Tabs.Tab key={value} value={value}>
              {value}
            </Tabs.Tab>
          ))}
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
