import type { ControlStore } from '@mechane/control-store';
import { RequestInvalid, SANDBOX_OWNERS_PATH, SandboxOwnerPage, SandboxOwnerQuery } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import { Option, Record, Schema } from 'effect';
import type { Redacted } from 'effect';
import { respondFailure } from '../http/failure.ts';
import { refuseInternalRequest } from '../http/internal-authorization.ts';

const OWNER_PAGE_MAX_ROWS = 200;
type SandboxOwnersInput = { readonly store: ControlStore; readonly bearer: Redacted.Redacted };

export function createSandboxOwnersHandler({ store, bearer }: SandboxOwnersInput) {
  return async function sandboxOwners(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (url.pathname !== SANDBOX_OWNERS_PATH) {
      return null;
    }

    const headers = { [HttpHeader.CacheControl]: 'no-store' };

    const refusal = refuseInternalRequest({ request, bearer, method: HttpMethod.Get });

    if (refusal !== null) {
      return refusal;
    }

    try {
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
