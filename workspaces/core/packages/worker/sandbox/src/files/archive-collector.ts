import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import { Result, Schema } from 'effect';

type AppendChunkInput = { readonly chunk: unknown };

type ArchiveCollector = {
  readonly append: (input: AppendChunkInput) => boolean;
  readonly contents: () => Uint8Array<ArrayBuffer>;
};

/** Owns a fixed-size buffer; oversized or non-byte chunks never enter it. */
export function archiveCollector(): ArchiveCollector {
  const bytes = new Uint8Array(SANDBOX_ARCHIVE_PART_BYTES);
  const state = { offset: 0 };

  const append: ArchiveCollector['append'] = ({ chunk }) => {
    const decoded = Schema.decodeUnknownResult(Schema.Uint8Array)(chunk);

    if (Result.isFailure(decoded)) {
      return false;
    }

    const value = decoded.success;

    if (state.offset + value.byteLength > bytes.byteLength) {
      return false;
    }

    bytes.set(value, state.offset);

    state.offset += value.byteLength;

    return true;
  };

  const contents: ArchiveCollector['contents'] = () => bytes.slice(0, state.offset);

  return { append, contents };
}
