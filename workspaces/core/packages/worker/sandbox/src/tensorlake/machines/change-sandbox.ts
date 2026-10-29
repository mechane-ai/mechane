import { HttpMethod } from '@mechane/records';
import type { RemoteSandboxId } from '@mechane/records';
import type { Redacted } from 'effect';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import type { TensorlakeAction } from './constants.ts';
import { sandboxUrl } from './sandbox-url.ts';

type ChangeSandboxInput = {
  readonly apiKey: Redacted.Redacted;
  readonly sandboxId: RemoteSandboxId;
  readonly action: TensorlakeAction;
};

/** Requests suspension or resumption of the saved VM without changing its identity. */
export async function changeSandbox({ apiKey, sandboxId, action }: ChangeSandboxInput): Promise<void> {
  const url = sandboxUrl({ name: sandboxId });
  const path = actionPath({ path: url.pathname, action });
  url.pathname = path;

  await tensorlakeRequest({ apiKey, url, init: { method: HttpMethod.Post } });
}

type ActionPathInput = { readonly path: string; readonly action: TensorlakeAction };

function actionPath({ path, action }: ActionPathInput): string {
  return `${path}/${action}`;
}
