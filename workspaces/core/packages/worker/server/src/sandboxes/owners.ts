import type { ControlStore } from '@mechane/control-store';
import { HttpHeader, HttpMethod } from '@mechane/records';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { InstalledDrainReport, SANDBOX_INSTALLED_DRAIN_PATH } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { respondFailure } from '../http/failure.ts';
import { refuseInternalRequest } from '../http/internal-authorization.ts';
import { drainInstalledAllocations } from './installed-drain.ts';

type SandboxOwnersInput = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };

export function createSandboxOwnersHandler({ store, configuration }: SandboxOwnersInput) {
  return async function sandboxOwners(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (url.pathname !== SANDBOX_INSTALLED_DRAIN_PATH) {
      return null;
    }

    const headers = { [HttpHeader.CacheControl]: 'no-store' };

    const refusal = refuseInternalRequest({ request, bearer: configuration.sandbox.bearer, method: HttpMethod.Post });

    if (refusal !== null) {
      return refusal;
    }

    try {
      const report = await drainInstalledAllocations({ store, configuration });

      return Response.json(Schema.encodeSync(InstalledDrainReport)(report), { headers });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
