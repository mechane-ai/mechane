import { PagePath } from '@mechane/protocol';
import type { ObjectUnavailable, RateLimited } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Array, Effect, Option } from 'effect';
import { showDevicePage } from './device/show-device-page.ts';
import { submitDeviceForm } from './device/submit-device-form.ts';
import { showLocalSignIn } from './local-sign-in/show-local-sign-in.ts';
import { submitLocalSignIn } from './local-sign-in/submit-local-sign-in.ts';
import { refusalPage } from './refusal-page.ts';
import { showHomePage } from './show-home-page.ts';
import { finishSignIn } from './sign-in/finish-sign-in.ts';
import type { PageFailure, PageInput } from './types.ts';

/** A page's request, and the address limit it counts against before its page serves it. */
type AnsweredPageInput = PageInput & { readonly addressLimit: Effect.Effect<void, RateLimited | ObjectUnavailable> };

/** Serves one page; the page's failures render as pages too. */
type ServePage = (input: PageInput) => Effect.Effect<Response, PageFailure>;

type PageRoute = { readonly method: HttpMethod; readonly path: PagePath; readonly serve: ServePage };

type FindPageInput = { readonly method: string; readonly pathname: string };

/** A page whose failures are already answered as pages. */
type AnsweredPage = (input: AnsweredPageInput) => Effect.Effect<Response>;

/** A page to serve once its address limit lets the request through. */
type ServePageInput = AnsweredPageInput & Pick<PageRoute, 'serve'>;

/** The pages a browser opens, beside the API's operations. */
const PAGES: ReadonlyArray<PageRoute> = [
  { method: HttpMethod.Get, path: PagePath.Home, serve: showHomePage },
  { method: HttpMethod.Get, path: PagePath.Device, serve: showDevicePage },
  { method: HttpMethod.Post, path: PagePath.Device, serve: submitDeviceForm },
  { method: HttpMethod.Get, path: PagePath.GitHubCallback, serve: finishSignIn },
  { method: HttpMethod.Get, path: PagePath.LocalSignIn, serve: showLocalSignIn },
  { method: HttpMethod.Post, path: PagePath.LocalSignIn, serve: submitLocalSignIn },
];

/**
 * The page that serves `method` on `pathname` once its address limit lets the request through, or none for the API. It
 * answers its failures, the limit's among them, with a page of its own.
 */
export function findPage({ method, pathname }: FindPageInput): Option.Option<AnsweredPage> {
  const route = Array.findFirst(PAGES, (page) => page.method === method && page.path === pathname);

  const answered: (page: PageRoute) => AnsweredPage =
    ({ serve }) =>
    (input) =>
      servePage({ serve, ...input });

  return Option.map(route, answered);
}

/** Serves a page once its address limit lets the request through, and answers each failure with a page of its own. */
const servePage = Effect.fn('servePage')(
  function* ({ serve, addressLimit, ...input }: ServePageInput): Effect.fn.Return<Response, PageFailure> {
    yield* addressLimit;

    return yield* serve(input);
  },
  Effect.catch((failure) => Effect.succeed(refusalPage({ failure }))),
);
