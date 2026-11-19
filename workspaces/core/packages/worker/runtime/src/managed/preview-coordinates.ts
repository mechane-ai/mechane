import { Schema } from 'effect';
import { ManagedDelegationOrigin } from './delegation/protocol.ts';

export const PreviewType = Schema.Literals(['agent.message', 'agent.thinking']);
export type PreviewType = typeof PreviewType.Type;

export const ManagedDelegationPreview = Schema.Struct({
  origin: ManagedDelegationOrigin,
  eventDeltas: Schema.Array(PreviewType),
});

export type ManagedDelegationPreview = typeof ManagedDelegationPreview.Type;

export const PreviewFrame = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('event_start'),
    event: Schema.Struct({ id: Schema.NonEmptyString, type: PreviewType }),
  }),
  Schema.Struct({
    type: Schema.Literal('event_delta'),
    event_id: Schema.NonEmptyString,
    delta: Schema.Struct({
      type: Schema.Literal('content_delta'),
      index: Schema.Int,
      content: Schema.Struct({ type: Schema.Literal('text'), text: Schema.String }),
    }),
  }),
]);

export type PreviewFrame = typeof PreviewFrame.Type;
export type PreviewSink = (delivery: PreviewDelivery) => boolean;

export function responseKey(taskId: number, timestamp: number, type: PreviewType): string {
  return JSON.stringify(['model-response', taskId, timestamp, type]);
}

export const PreviewDelivery = Schema.Struct({ spanId: Schema.NonEmptyString, frame: PreviewFrame });
export type PreviewDelivery = typeof PreviewDelivery.Type;
