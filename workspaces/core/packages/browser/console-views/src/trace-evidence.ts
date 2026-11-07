import { Dispatch, Turn } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import { DateTime, Option, Schema } from 'effect';
import { createRequestWaterfallItem } from './request-waterfall.tsx';

/** Recorded endpoints, cost and usage shared by the overview and request inspector. */
export function traceEvidence(trace: Trace) {
  const turn = Schema.is(Turn)(trace.turn) ? trace.turn : undefined;
  const settled = trace.dispatches.filter(Schema.is(Dispatch)).filter((request) => request.status === 'settled');
  const cost = settled.reduce((total, request) => total + request.settledMicros, 0);
  const reported = settled.filter((request) => request.basis === 'usage');

  const tokens = reported.reduce(
    (total, request) =>
      total + request.inputTokens + request.outputTokens + request.cacheReadTokens + request.cacheWriteTokens,
    0,
  );

  const items = trace.dispatches.map((request, index) => createRequestWaterfallItem({ request, number: index + 1 }));

  const times = items.flatMap(({ geometry }) => {
    if (geometry.kind === 'interval') {
      return [geometry.start, geometry.end];
    }

    if (geometry.kind === 'point') {
      return [geometry.at];
    }

    return [];
  });

  const startedAt = turn === undefined ? undefined : Option.getOrUndefined(turn.startedAt);
  const started = startedAt === undefined ? undefined : DateTime.toEpochMillis(startedAt);

  const start =
    started ??
    (turn === undefined ? (times.length === 0 ? 0 : Math.min(...times)) : DateTime.toEpochMillis(turn.createdAt));

  const finished = turn !== undefined && 'endedAt' in turn ? DateTime.toEpochMillis(turn.endedAt) : undefined;
  const elapsed = started === undefined || finished === undefined ? undefined : finished - started;
  const end = Math.max(start, finished ?? start, ...times);

  const notices = [...new Set(trace.evidenceNotices)];

  if (trace.toolCalls === undefined) {
    notices.push('Tool evidence is unavailable for this run.');
  }

  const usageLabel = tokenUsageLabel({
    totalRequests: trace.dispatches.length,
    reportedRequests: reported.length,
    tokens,
  });

  return {
    turn,
    items,
    start,
    end,
    finished,
    elapsed,
    cost,
    tokens,
    reported: reported.length,
    settled: settled.length,
    notices,
    usageLabel,
  };
}

function tokenUsageLabel({
  totalRequests,
  reportedRequests,
  tokens,
}: {
  readonly totalRequests: number;
  readonly reportedRequests: number;
  readonly tokens: number;
}): string | undefined {
  if (totalRequests === 0) {
    return undefined;
  }

  if (reportedRequests === 0) {
    return 'Tokens not reported';
  }

  const coverage = reportedRequests < totalRequests ? ` · ${reportedRequests}/${totalRequests} requests` : '';

  return `${tokens.toLocaleString('en-US')} tokens reported${coverage}`;
}
