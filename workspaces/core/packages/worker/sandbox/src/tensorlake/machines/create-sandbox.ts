import { HttpMethod, HttpStatusCode, RemoteSandboxId, renamedWireStruct } from '@mechane/records';
import { TENSORLAKE_ORIGIN, TensorlakePath } from '../constants.ts';
import { tensorlakeAnswer } from '../tensorlake-answer.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import type { TensorlakeSettings } from '../types.ts';
import { readSandbox } from './read-sandbox.ts';
import { sandboxStart } from './sandbox-start.ts';

const CreatedSandbox = renamedWireStruct({
  fields: { sandboxId: RemoteSandboxId },
  renames: { sandboxId: 'sandbox_id' },
});

/** Binds a successful creation before any guest can run; a raced name is resolved from the provider. */
export async function createSandbox({ ...settings }: TensorlakeSettings): Promise<void> {
  const { apiKey, store } = settings;
  const url = new URL(TensorlakePath.Sandboxes, TENSORLAKE_ORIGIN);
  const body = sandboxStart(settings);
  const response = await tensorlakeRequest({ apiKey, url, init: { method: HttpMethod.Post, body } });

  if (response.status === HttpStatusCode.Conflict) {
    await readSandbox(settings);

    return;
  }

  const created = await tensorlakeAnswer({ response, schema: CreatedSandbox });

  store.bindRemoteSandbox({ sandboxId: created.sandboxId });
}
