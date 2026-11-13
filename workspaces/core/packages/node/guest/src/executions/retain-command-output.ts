import { Bytes, BYTES_PER_MEBIBYTE } from '@mechane/records';
import { OUTPUT_TAIL_BYTES } from '@mechane/sandbox-wire';
import type { ExecutionId, ExecutionOutput } from '@mechane/sandbox-wire';
import { DateTime, Effect } from 'effect';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { outputTail } from './output-tail.ts';
import { OutputFileStatus, saveCommandOutput } from './save-command-output.ts';

const OUTPUT_FILE_MEBIBYTES = 4;
export const OUTPUT_FILE_BYTES = Bytes.make(OUTPUT_FILE_MEBIBYTES * BYTES_PER_MEBIBYTE);
const TIMESTAMP_DIGITS = 16;

type RetainCommandOutputInput = {
  readonly executionId: ExecutionId;
  readonly home: string;
  readonly output: ExecutionOutput;
};

/** Keeps a short receipt and a larger, already-redacted file without changing the observed command outcome. */
export const retainCommandOutput = Effect.fn('retainCommandOutput')(function* ({
  executionId,
  home,
  output,
}: RetainCommandOutputInput): Effect.fn.Return<ExecutionOutput> {
  const retained = outputTail({ limit: OUTPUT_FILE_BYTES });

  const content = Buffer.from(output.text);

  retained.push({ chunk: content });

  const fileOutput = retained.output();
  const bytes = Buffer.from(fileOutput.text);
  const fileOmittedBytes = output.omittedBytes + fileOutput.omittedBytes;

  if (bytes.length <= OUTPUT_TAIL_BYTES && fileOmittedBytes === 0) {
    return output;
  }

  const directory = join(home, '.mechane-output');
  const name = createHash('sha256').update(executionId).digest('hex');
  const now = DateTime.nowUnsafe();
  const millis = DateTime.toEpochMillis(now);
  const timestamp = String(millis).padStart(TIMESTAMP_DIGITS, '0');
  const path = join(directory, `${timestamp}-${name}.log`);

  let completeness = 'complete, redacted output';

  if (fileOmittedBytes > 0) {
    completeness = `retained tail; ${fileOmittedBytes} earlier bytes omitted`;
  }

  const saved = yield* saveCommandOutput({ directory, path, bytes });
  let notice = 'Output file unavailable. Only this excerpt was retained; the command was not repeated.';

  if (saved === OutputFileStatus.Saved) {
    notice = `Output file: ${path} (${completeness}). The newest 64 output files are kept. Inspect it with bash.`;
  }

  const suffix = `\n[${notice}]`;
  const noticeBytes = Buffer.byteLength(suffix);
  const limit = Bytes.make(OUTPUT_TAIL_BYTES - noticeBytes);
  const tail = outputTail({ limit });

  tail.push({ chunk: bytes });

  const excerpt = tail.output();

  return { text: `${excerpt.text}${suffix}`, omittedBytes: Bytes.make(fileOmittedBytes + excerpt.omittedBytes) };
});
