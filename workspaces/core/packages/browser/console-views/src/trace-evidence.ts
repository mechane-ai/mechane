import { Dispatch, Turn } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import type { TimelineItem } from '@mechane/ui';
import { DateTime, Schema } from 'effect';
import { durationLabel, moneyLabel } from './format.ts';

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

  const items = trace.dispatches.map((request, index): TimelineItem => {
    const base = { id: request.id, label: `Request ${index + 1}`, detail: request.model };

    if (!Schema.is(Dispatch)(request)) {
      return { ...base, start: null, end: null, state: 'unknown', summary: 'Newer format' };
    }

    const start = DateTime.toEpochMillis(request.decidedAt);

    if (request.status !== 'settled') {
      return {
        ...base,
        start,
        end: null,
        state: request.status === 'refused' ? 'refused' : 'pending',
        summary: request.status === 'refused' ? 'Refused' : 'Reserved',
      };
    }

    const end = DateTime.toEpochMillis(request.settledAt);

    return {
      ...base,
      start,
      end,
      state: 'complete',
      summary: `Settled · ${durationLabel(end - start)} · ${moneyLabel(request.settledMicros)}`,
    };
  });

  const times = items.flatMap((item) => [item.start, item.end].filter((time) => time !== null));

  const start =
    turn === undefined ? (times.length === 0 ? 0 : Math.min(...times)) : DateTime.toEpochMillis(turn.startedAt);

  const finished = turn !== undefined && turn.status !== 'running' ? DateTime.toEpochMillis(turn.endedAt) : undefined;
  const end = Math.max(start, finished ?? start, ...times);

  return { turn, items, start, end, finished, cost, tokens, reported: reported.length, settled: settled.length };
}
