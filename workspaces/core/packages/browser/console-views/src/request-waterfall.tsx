import { Dispatch } from '@mechane/protocol';
import type { TracedDispatch } from '@mechane/protocol';
import { Waterfall } from '@mechane/ui/charts';
import type { WaterfallItem } from '@mechane/ui/charts';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel } from './format.ts';

type RequestWaterfallItem = WaterfallItem & { readonly status: Dispatch['status'] | 'unavailable' };

type RequestWaterfallProps = {
  readonly items: ReadonlyArray<RequestWaterfallItem>;
  readonly start: number;
  readonly end: number;
  readonly selectedId: string | undefined;
  readonly onRequest: (id: string) => void;
};

export function RequestWaterfall({ items, start, end, selectedId, onRequest }: RequestWaterfallProps): ReactNode {
  return (
    <Waterfall
      items={items}
      start={start}
      end={end}
      label="Request timing"
      rowLabel="Model request"
      summaryLabel="Recorded outcome"
      emptyLabel="No model requests recorded"
      selectedId={selectedId}
      onSelect={onRequest}
      formatOffset={durationLabel}
    />
  );
}

export function createRequestWaterfallItem({
  request,
  number,
}: {
  readonly request: TracedDispatch;
  readonly number: number;
}): RequestWaterfallItem {
  const base = { id: request.id, label: `Request ${number}`, detail: request.model };

  if (!Schema.is(Dispatch)(request)) {
    return {
      ...base,
      status: 'unavailable',
      geometry: { kind: 'unavailable' },
      tone: 'neutral',
      summary: 'Newer format',
    };
  }

  const knownRequest: Dispatch = request;
  const start = DateTime.toEpochMillis(knownRequest.decidedAt);

  switch (knownRequest.status) {
    case 'reserved':
      return {
        ...base,
        status: knownRequest.status,
        geometry: { kind: 'point', at: start, marker: 'hollow' },
        tone: 'neutral',
        summary: 'Reserved',
      };
    case 'refused':
      return {
        ...base,
        status: knownRequest.status,
        geometry: { kind: 'point', at: start, marker: 'diamond' },
        tone: 'negative',
        summary: 'Refused',
      };
    case 'settled': {
      const end = DateTime.toEpochMillis(knownRequest.settledAt);

      return {
        ...base,
        status: knownRequest.status,
        geometry: { kind: 'interval', start, end },
        tone: 'positive',
        summary: `Settled · ${durationLabel(end - start)} · ${moneyLabel(knownRequest.settledMicros)}`,
      };
    }
  }
}
