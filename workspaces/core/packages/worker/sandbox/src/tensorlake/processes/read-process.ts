import { HttpStatusCode } from '@mechane/records';
import { Option, Schema } from 'effect';
import { ProcessStatus } from '../constants.ts';
import { tensorlakeAnswer } from '../tensorlake-answer.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import { processUrl } from './process-url.ts';
import type { RemoteProcessInput } from './types.ts';

/** The status retained by Tensorlake for an idempotently named guest process. */
const RemoteProcess = Schema.Struct({ status: Schema.Enum(ProcessStatus) });

type RemoteProcess = typeof RemoteProcess.Type;

/** Reads a named process receipt; absence means this identity never started or its VM lost the receipt. */
export async function readProcess({
  apiKey,
  origin,
  machineId,
}: RemoteProcessInput): Promise<Option.Option<RemoteProcess>> {
  const url = processUrl({ origin, machineId });
  const response = await tensorlakeRequest({ apiKey, url, init: {} });

  if (response.status === HttpStatusCode.NotFound) {
    return Option.none();
  }

  const process = await tensorlakeAnswer({ response, schema: RemoteProcess });

  return Option.some(process);
}
