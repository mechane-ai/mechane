import { Effect } from 'effect';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvalCallId } from '../application-schemas.ts';
import { EvalFileStep } from '../constants.ts';
import type { EvalRole } from '../constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation, EvalFileFailed } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { RECORD_FOLDER_MODE } from './constants.ts';
import { createRecordFile } from './create-record-file.ts';

type BeginObservedToolInput = {
  readonly folder: string;
  readonly role: EvalRole;
  readonly callId: EvalCallId;
  readonly requestDigest: string;
  readonly maxToolRequests: number;
};

/** A started call without a saved observation may already have changed the application fixture. */
export const beginObservedTool = Effect.fn('beginObservedTool')(function* ({
  folder,
  role,
  callId,
  requestDigest,
  maxToolRequests,
}: BeginObservedToolInput): Effect.fn.Return<void, EvalAdapterFailed | EvalFileFailed> {
  const directory = join(folder, role, 'tool-attempts');
  const name = `${jsonDigest({ value: callId })}.json`;
  const path = join(directory, name);

  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true, mode: RECORD_FOLDER_MODE }),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.CreateFolder, path: directory, reason: String(cause) }),
  });

  const entries = yield* Effect.tryPromise({
    try: () => readdir(directory),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: directory, reason: String(cause) }),
  });

  const attempts = entries.filter((entry) => entry.endsWith('.json'));

  if (attempts.includes(name)) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ReplayTool,
      reason: `Tool call ${callId} was started but its result was not saved. Its execution outcome is unknown`,
    });
  }

  if (attempts.length >= maxToolRequests) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ExecuteTool,
      reason: 'The frozen tool-call bound was reached',
    });
  }

  const text = JSON.stringify({ callId, requestDigest });

  yield* createRecordFile({ path, text });
});
