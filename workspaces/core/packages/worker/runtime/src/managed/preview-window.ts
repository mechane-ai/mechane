import type { PreviewDelivery, PreviewFrame } from './preview-coordinates.ts';
import type { ManagedEvent } from './protocol.ts';

const deferredFrameLimitCount = 16;

function frameId(frame: PreviewFrame) {
  if (frame.type === 'event_start') {
    return frame.event.id;
  }

  return frame.event_id;
}

// Child previews can arrive before the parent has mirrored the model span, or after it has ended.
export function previewWindow(write: (frame: PreviewFrame) => boolean) {
  const span = { open: '' };
  const finished = new Set<string>();
  const pending = { spanId: '', frames: new Array<PreviewFrame>() };

  function receive({ spanId, frame }: PreviewDelivery) {
    if (span.open === spanId) {
      return !finished.has(frameId(frame)) && write(frame);
    }

    if (pending.spanId !== spanId) {
      pending.spanId = spanId;
      pending.frames.length = 0;
    }

    if (pending.frames.length >= deferredFrameLimitCount) {
      return false;
    }

    pending.frames.push(frame);

    return true;
  }

  function reconcile(event: ManagedEvent) {
    switch (event.type) {
      case 'span.model_request_start':
        span.open = event.id;

        finished.clear();

        if (pending.spanId === span.open) {
          for (const frame of pending.frames) {
            if (!write(frame)) {
              finished.add(frameId(frame));
            }
          }

          pending.frames.length = 0;
        }

        break;
      case 'agent.message':
      case 'agent.thinking':
        if (span.open.length > 0) {
          finished.add(event.id);
        }

        break;
      case 'span.model_request_end':
        if (event['model_request_start_id'] === span.open) {
          span.open = '';

          finished.clear();
        }

        if (event['model_request_start_id'] === pending.spanId) {
          pending.frames.length = 0;
        }

        break;
      default:
        break;
    }
  }

  return { receive, reconcile };
}
