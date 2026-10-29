import { decodeSettings, limitAddress } from '@mechane/bindings';
import { LimitPolicy } from '@mechane/deployment';
import {
  failureMessage,
  findReleaseRoute,
  findRoute,
  peer as peerOf,
  respondFailure,
  serveNamed,
  serveSlackEvents,
} from '@mechane/edge';
import { findPage } from '@mechane/pages';
import { catalog } from '@mechane/protocol';
import type { ServerFailure } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { WorkerEnvironment } from '@mechane/rpc';
import { Effect, Option } from 'effect';
import { canonicalUrl } from './canonical-url.ts';

type ServeInput = { readonly request: Request; readonly environment: WorkerEnvironment };

/**
 * Answers one request: a browser page, the install script or a release file, or a catalog operation whose every failure
 * becomes an error response with the status its family fixes. Every request but health first counts against its
 * address's limit, when the platform names the address, and a page answers that refusal with a page too.
 */
export const serve = Effect.fn('serve')(
  function* ({ request, environment }: ServeInput): Effect.fn.Return<Response, ServerFailure> {
    const url = new URL(request.url);
    const settings = yield* decodeSettings({ environment });

    // Sign-in must start on the callback's origin so its host-only state cookie reaches the callback.
    if (url.origin !== settings.origin.origin) {
      const canonical = canonicalUrl({ url, origin: settings.origin });

      const headers = { [HttpHeader.Location]: canonical.href, [HttpHeader.CacheControl]: 'no-store' };

      return new Response(null, { status: HttpStatusCode.Found, headers });
    }

    const peer = yield* peerOf({ request });
    const address = Option.filter(peer.address, () => url.pathname !== catalog.health.path);
    const addressLimit = limitAddress({ settings, policy: LimitPolicy.Address, address });
    const page = findPage({ method: request.method, pathname: url.pathname });

    if (Option.isSome(page)) {
      return yield* page.value({ request, url, settings, addressLimit });
    }

    yield* addressLimit;

    const slack = yield* serveSlackEvents({ request, url, settings });

    if (Option.isSome(slack)) {
      return slack.value;
    }

    const release = findReleaseRoute({ method: request.method, pathname: url.pathname });

    if (Option.isSome(release)) {
      return yield* release.value({ settings });
    }

    const { name, params } = yield* findRoute({ method: request.method, pathname: url.pathname });

    return yield* serveNamed({ name, routed: { request, url, params }, settings, peer });
  },
  Effect.catch((failure) => Effect.succeed(respondFailure({ failure, message: failureMessage({ failure }) }))),
);
