import type { ControlStore } from '@mechane/control-store';
import { RequestInvalid, SANDBOX_OWNERS_PATH, SandboxOwnerPage, SandboxOwnerQuery } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { InstalledDrainReport, SANDBOX_INSTALLED_DRAIN_PATH } from '@mechane/sandbox-wire';
import { Option, Record, Schema } from 'effect';
import { respondFailure } from '../http/failure.ts';
import { refuseInternalRequest } from '../http/internal-authorization.ts';
import { drainInstalledAllocations } from './installed-drain.ts';

const OWNER_PAGE_MAX_ROWS = 200;

const routes: ReadonlyMap<string, HttpMethod> = new Map([
  [SANDBOX_OWNERS_PATH, HttpMethod.Get],
  [SANDBOX_INSTALLED_DRAIN_PATH, HttpMethod.Post],
]);

type SandboxOwnersInput = { readonly store: ControlStore; readonly configuration: RuntimeConfiguration };

export function createSandboxOwnersHandler({ store, configuration }: SandboxOwnersInput) {
  return async function sandboxOwners(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    const method = routes.get(url.pathname);

    if (method === undefined) {
      return null;
    }

    const headers = { [HttpHeader.CacheControl]: 'no-store' };

    const refusal = refuseInternalRequest({ request, bearer: configuration.sandbox.bearer, method });

    if (refusal !== null) {
      return refusal;
    }

    try {
      if (url.pathname === SANDBOX_INSTALLED_DRAIN_PATH) {
        const report = await drainInstalledAllocations({ store, configuration });

        return Response.json(Schema.encodeSync(InstalledDrainReport)(report), { headers });
      }

      const decoded = Schema.decodeUnknownResult(SandboxOwnerQuery, { onExcessProperty: 'error' })(
        Record.fromEntries(url.searchParams),
      );

      if (decoded._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The sandbox owner cursor is invalid' });
      }

      const page = await store.listActiveSandboxOwners({
        afterMechId: Option.getOrNull(decoded.success.afterMechId),
        maxRows: OWNER_PAGE_MAX_ROWS,
      });

      const next: { mechId: string | null } = { mechId: null };
      const last = page.items.at(-1);

      if (page.hasMore && last !== undefined) {
        next.mechId = last.mechId;
      }

      const body = Schema.decodeUnknownSync(SandboxOwnerPage)({
        owners: page.items,
        hasMore: page.hasMore,
        nextAfterMechId: next.mechId,
      });

      return Response.json(Schema.encodeSync(SandboxOwnerPage)(body), { headers });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
