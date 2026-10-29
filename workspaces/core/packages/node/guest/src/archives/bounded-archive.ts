import type { Bytes } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Transform } from 'node:stream';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';

type BoundedArchiveInput = Pick<WorkspaceFilesInput, 'generation'> & { readonly maximumBytes: Bytes };

/** Fails a streaming archive as soon as its byte count exceeds the configured limit. */
export function boundedArchive({ generation, maximumBytes }: BoundedArchiveInput): Transform {
  const state = { bytes: 0 };

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      state.bytes += chunk.byteLength;

      if (state.bytes > maximumBytes) {
        const failure = new WorkspaceFailed({
          generation,
          step: WorkspaceStep.Archive,
          reason: `workspace exceeds its ${maximumBytes} byte limit`,
        });

        callback(failure);

        return;
      }

      callback(null, chunk);
    },
  });
}
