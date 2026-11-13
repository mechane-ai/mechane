import { Bytes } from '@mechane/records';
import type { SettledReceipt } from '@mechane/sandbox-wire';
import { MutableRef } from 'effect';

type ChunkInput = { readonly chunk: Buffer };

/** The bits that mark a byte inside a UTF-8 sequence, which a tail's text skips at its start. */
const UTF8_CONTINUATION = { mask: 0xc0, marker: 0x80 } as const;

/** The tail of an execution's combined output as it arrives. */
type OutputTail = { readonly push: (input: ChunkInput) => void; readonly output: () => SettledReceipt['output'] };

type OutputTailInput = { readonly limit: Bytes };

/** A fixed-size ring keeps draining noisy processes without repeatedly copying the retained output. */
export function outputTail({ limit }: OutputTailInput): OutputTail {
  const buffer = Buffer.alloc(limit);
  const received = MutableRef.make(0);

  const push: OutputTail['push'] = ({ chunk }) => {
    const total = MutableRef.get(received);
    const skipped = Math.max(0, chunk.length - limit);
    const written = chunk.subarray(skipped);
    const position = (total + skipped) % limit;
    const firstLength = Math.min(written.length, limit - position);

    written.copy(buffer, position, 0, firstLength);
    written.copy(buffer, 0, firstLength);
    MutableRef.set(received, total + chunk.length);
  };

  const output: OutputTail['output'] = () => {
    const total = MutableRef.get(received);
    const size = Math.min(total, limit);
    let start = 0;

    if (total >= limit) {
      start = total % limit;
    }

    const firstEnd = Math.min(limit, start + size);
    const first = buffer.subarray(start, firstEnd);
    const second = buffer.subarray(0, size - first.length);
    const bytes = Buffer.concat([first, second]);
    const droppedBytes = Math.max(0, total - limit);
    // oxlint-disable-next-line no-bitwise -- a UTF-8 continuation byte is marked in its top two bits
    const character = bytes.findIndex((byte) => (byte & UTF8_CONTINUATION.mask) !== UTF8_CONTINUATION.marker);
    const skipped = Math.max(character, 0);

    return {
      text: new TextDecoder().decode(bytes.subarray(skipped)),
      omittedBytes: Bytes.make(droppedBytes + skipped),
    };
  };

  return { push, output };
}
