import { afterSettling } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import { archiveCollector } from './archive-collector.ts';

/** An archive response cannot provide a bounded protocol part. */
class ArchivePartInvalid extends Schema.TaggedError<ArchivePartInvalid>()('ArchivePartInvalid', {
  status: Schema.Int,
}) {}

type ReadArchivePartInput = { readonly response: Response };
type ReadChunksInput = { readonly reader: ReadableStreamDefaultReader; readonly failure: ArchivePartInvalid };

/** Caps buffered file bytes even if a guest replaced an archive part with a larger file. */
export async function readArchivePart({ response }: ReadArchivePartInput): Promise<Uint8Array<ArrayBuffer>> {
  const failure = new ArchivePartInvalid({ status: response.status });
  const stream = Option.fromNullishOr(response.body);

  if (!response.ok || Option.isNone(stream)) {
    const refused = Result.fail(failure);

    return Result.getOrThrow(refused);
  }

  const reader = stream.value.getReader();
  const promise = readChunks({ reader, failure });

  return await afterSettling({ promise, run: () => reader.releaseLock() });
}

async function readChunks({ reader, failure }: ReadChunksInput): Promise<Uint8Array<ArrayBuffer>> {
  const collector = archiveCollector();

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    const isAccepted = collector.append({ chunk: chunk.value });

    if (!isAccepted) {
      await reader.cancel();

      const refused = Result.fail(failure);

      return Result.getOrThrow(refused);
    }
  }

  return collector.contents();
}
