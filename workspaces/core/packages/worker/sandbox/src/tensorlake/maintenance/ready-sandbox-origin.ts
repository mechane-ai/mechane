import { HttpMethod } from '@mechane/records';
import { Option } from 'effect';
import { TensorlakeStatus } from '../constants.ts';
import { inspectRemote } from '../machines/inspect-remote.ts';
import { sandboxUrl } from '../machines/sandbox-url.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import type { RemoteInput } from '../types.ts';

/** A suspended VM resumes before any archive or restoration work is attempted. */
export async function readySandboxOrigin({ apiKey, name }: RemoteInput): Promise<Option.Option<URL>> {
  const found = await inspectRemote({ apiKey, name });

  if (Option.isNone(found)) {
    return Option.none();
  }

  if (found.value.status === TensorlakeStatus.Suspended) {
    const url = sandboxUrl({ name });
    url.pathname += '/resume';

    await tensorlakeRequest({ apiKey, url, init: { method: HttpMethod.Post } });

    return Option.none();
  }

  if (found.value.status !== TensorlakeStatus.Running) {
    return Option.none();
  }

  return found.value.sandbox_url;
}
