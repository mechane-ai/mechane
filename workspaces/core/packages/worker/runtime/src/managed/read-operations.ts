import { HttpStatusCode } from '@mechane/records';
import type { ResolveDelegationTarget } from './delegation/dispatch.ts';
import { ManagedDelegationRead } from './delegation/protocol.ts';
import { receiveDelegationRead } from './delegation/receiver.ts';
import { decodeManagedInput, failManagedRequest } from './failure.ts';
import { ManagedDelegationPreview } from './preview-coordinates.ts';
import { delegatedPreviews, watchSessionPreviews } from './preview-relay.ts';
import type { ManagedAgentScope, ManagedEvent } from './protocol.ts';
import {
  ManagedEventPageInput,
  ManagedSessionReference,
  ManagedSessionThreadReference,
  ManagedStreamRequest,
  ManagedThreadPageInput,
} from './protocol.ts';
import type { SessionObserver } from './session-observer.ts';
import type { ManagedSessionReader } from './session-reader.ts';
import { managedStream } from './stream.ts';

type ReadOperation = {
  readonly scope: ManagedAgentScope;
  readonly method: string;
  readonly input: unknown;
  readonly reader: ManagedSessionReader;
  readonly delegate: ResolveDelegationTarget;
  readonly observe: SessionObserver;
  readonly source: EventTarget;
  readonly signal: AbortSignal;
  readonly subscribeDeleted?: ((listener: (event: ManagedEvent) => void, signal: AbortSignal) => void) | undefined;
  readonly onStreamClose?: (() => void) | undefined;
};

export async function runManagedReadOperation({
  scope,
  method,
  input,
  reader,
  delegate,
  observe,
  source,
  signal,
  subscribeDeleted,
  onStreamClose,
}: ReadOperation): Promise<Response> {
  switch (method) {
    case 'read':
      return Response.json(await reader.read(decodeManagedInput(ManagedSessionReference, input)));
    case 'events':
      return Response.json(await reader.events(decodeManagedInput(ManagedEventPageInput, input)));
    case 'threads':
      return Response.json(await reader.threads(decodeManagedInput(ManagedThreadPageInput, input)));
    case 'thread':
      return Response.json(await reader.thread(decodeManagedInput(ManagedSessionThreadReference, input)));
    case 'delegateRead':
      return Response.json(
        await receiveDelegationRead(reader, scope, decodeManagedInput(ManagedDelegationRead, input)),
      );
    case 'delegatePreviews':
      return await delegatedPreviews({
        reader,
        observe,
        scope,
        input: decodeManagedInput(ManagedDelegationPreview, input),
        signal,
        onStreamClose,
      });
    case 'stream': {
      const request = decodeManagedInput(ManagedStreamRequest, input);

      return await managedStream({
        offset: await reader.tail(request),
        readChanges: (position) => observe.read((current) => current.changes(position)),
        scope: request,
        source,
        signal,
        subscribeDeleted,
        onStreamClose,
        watchPreviews: (observer) => watchSessionPreviews({ reader, observe, scope: request, delegate }, observer),
      });
    }
    default:
      return failManagedRequest(HttpStatusCode.NotFound, 'Unknown managed agent read');
  }
}
