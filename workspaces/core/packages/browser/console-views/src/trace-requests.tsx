import { Muted, Stack, Subheading } from '@mechane-ai/elements';
import { Inspector } from '@mechane-ai/elements/collections';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import type { Trace } from '@mechane/protocol';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RequestWaterfall } from './request-waterfall.tsx';
import type { traceEvidence } from './trace-evidence.ts';
import { TraceRequest } from './trace-request.tsx';

export function TraceRequests({
  trace,
  evidence,
  requestId,
  onRequest,
  requestHref,
}: {
  readonly trace: Trace;
  readonly evidence: ReturnType<typeof traceEvidence>;
  readonly requestId: string | undefined;
  readonly onRequest: (id: string) => void;
  readonly requestHref: (id: string) => string;
}): ReactNode {
  const { items, start, end } = evidence;
  const count = items.length;
  const selectedRow = useRef<HTMLButtonElement>(null);
  const [reveal, setReveal] = useState<{ readonly id: string; readonly revision: number }>();

  function selectRequest(id: string): void {
    setReveal((prior) => ({ id, revision: (prior?.revision ?? 0) + 1 }));
    onRequest(id);
  }

  const revealKey = reveal !== undefined && reveal.id === requestId ? `${requestId}:${reveal.revision}` : requestId;

  if (count === 0) {
    return <EmptyState title="No model requests recorded" />;
  }

  const selected =
    requestId === undefined ? trace.dispatches[0] : trace.dispatches.find((request) => request.id === requestId);

  return (
    <Inspector
      label="Selected model request"
      masterLabel="Model requests"
      revealKey={revealKey}
      returnFocusRef={selectedRow}
      master={
        <Stack compact>
          <Subheading>{count === 1 ? '1 model request' : `${count} model requests`}</Subheading>
          <Muted>Timing covers reservation to settlement.</Muted>
          <RequestWaterfall
            start={start}
            end={end}
            onRequest={selectRequest}
            items={items}
            selectedId={selected?.id}
            selectedRef={selectedRow}
          />
        </Stack>
      }
      detail={
        selected === undefined ? (
          <Notice>This request is unavailable in this run. Select a recorded request.</Notice>
        ) : (
          <TraceRequest
            key={selected.id}
            request={selected}
            number={trace.dispatches.indexOf(selected) + 1}
            href={requestHref(selected.id)}
          />
        )
      }
    />
  );
}
