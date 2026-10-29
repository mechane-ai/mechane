import { Bytes } from '@mechane/records';
import { OUTPUT_TAIL_BYTES } from '@mechane/sandbox-wire';
import type { SettledReceipt } from '@mechane/sandbox-wire';
import { MutableRef } from 'effect';

type ChunkInput = { readonly chunk: Buffer };

/** The bits that mark a byte inside a UTF-8 sequence, which a tail's text skips at its start. */
const UTF8_CONTINUATION = { mask: 0xc0, marker: 0x80 } as const;

/** The tail of an execution's combined output as it arrives. */
type OutputTail = { readonly push: (input: ChunkInput) => void; readonly output: () => SettledReceipt['output'] };

/** The bytes of the output kept so far, and how many bytes before them were dropped. */
type KeptTail = { readonly bytes: Buffer; readonly droppedBytes: Bytes };

/**
 * The combined output's tail, at most the receipt's bytes, and how many bytes before it were dropped. Its text starts
 * on a character, and an invalid sequence decodes to the replacement character.
 */
export function outputTail(): OutputTail {
  const kept = MutableRef.make<KeptTail>({ bytes: Buffer.alloc(0), droppedBytes: Bytes.make(0) });

  const push: OutputTail['push'] = ({ chunk }) => {
    const { bytes, droppedBytes } = MutableRef.get(kept);
    const joined = Buffer.concat([bytes, chunk]);
    const excess = Math.max(joined.length - OUTPUT_TAIL_BYTES, 0);

    MutableRef.set(kept, { bytes: joined.subarray(excess), droppedBytes: Bytes.make(droppedBytes + excess) });
  };

  const output: OutputTail['output'] = () => {
    const { bytes, droppedBytes } = MutableRef.get(kept);
    // oxlint-disable-next-line no-bitwise -- a UTF-8 continuation byte is marked in its top two bits
    const start = bytes.findIndex((byte) => (byte & UTF8_CONTINUATION.mask) !== UTF8_CONTINUATION.marker);
    const skipped = Math.max(start, 0);

    return {
      text: new TextDecoder().decode(bytes.subarray(skipped)),
      omittedBytes: Bytes.make(droppedBytes + skipped),
    };
  };

  return { push, output };
}
