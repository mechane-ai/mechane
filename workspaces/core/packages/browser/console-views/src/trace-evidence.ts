import { Dispatch, Turn } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
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

  const start =
    turn === undefined ? (times.length === 0 ? 0 : Math.min(...times)) : DateTime.toEpochMillis(turn.startedAt);

  const finished = turn !== undefined && turn.status !== 'running' ? DateTime.toEpochMillis(turn.endedAt) : undefined;
  const end = Math.max(start, finished ?? start, ...times);

  return { turn, items, start, end, finished, cost, tokens, reported: reported.length, settled: settled.length };
}
