import { Array, Option } from 'effect';
import { HEADER_END, LENGTH_HEADER } from './constants.ts';

/** The bytes the server wrote so far that no message took. */
type SplitFramesInput = { readonly bytes: Buffer };

/** The bodies of the whole messages a chunk completed, and the bytes of the next one so far. */
type Frames = { readonly frames: ReadonlyArray<string>; readonly rest: Buffer };

/** One whole message's body, and the bytes after it. */
type Frame = { readonly body: string; readonly rest: Buffer };

/** The whole messages at the start of `bytes`, and the bytes of the one that has not arrived in full. */
export function splitFrames({ bytes }: SplitFramesInput): Frames {
  /** The first whole message of the bytes and the bytes after it, none once a message has not arrived in full. */
  const nextFrame: (remaining: Buffer) => Option.Option<readonly [Frame, Buffer]> = (remaining) =>
    Option.map(firstFrame({ bytes: remaining }), (frame) => [frame, frame.rest] as const);

  const read = Array.unfold(bytes, nextFrame);
  const rest = Option.match(Array.last(read), { onNone: () => bytes, onSome: (frame) => frame.rest });

  return { frames: read.map(({ body }) => body), rest };
}

/** The first message of `bytes` when it has arrived in full: its body, and the bytes after it. */
function firstFrame({ bytes }: SplitFramesInput): Option.Option<Frame> {
  const headerEnd = bytes.indexOf(HEADER_END);
  const header = bytes.subarray(0, headerEnd).toString();
  const bodyStart = headerEnd + HEADER_END.length;
  const bodyEnd = bodyStart + Number(header.slice(header.indexOf(LENGTH_HEADER) + LENGTH_HEADER.length));

  if (headerEnd === -1 || bytes.length < bodyEnd) {
    return Option.none();
  }

  return Option.some({ body: bytes.subarray(bodyStart, bodyEnd).toString(), rest: bytes.subarray(bodyEnd) });
}
