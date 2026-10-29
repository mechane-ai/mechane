import { HttpStatusCode } from '@mechane/records';
import { Option } from 'effect';
import { tensorlakeAnswer } from '../tensorlake-answer.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import type { RemoteInput } from '../types.ts';
import { sandboxUrl } from './sandbox-url.ts';
import { Remote } from './schemas.ts';

/** Inspection does not bind, create or resume a VM. */
export async function inspectRemote({ apiKey, name }: RemoteInput): Promise<Option.Option<Remote>> {
  const url = sandboxUrl({ name });
  const response = await tensorlakeRequest({ apiKey, url, init: {} });

  if (response.status === HttpStatusCode.NotFound) {
    return Option.none();
  }

  const remote = await tensorlakeAnswer({ response, schema: Remote });

  return Option.some(remote);
}
