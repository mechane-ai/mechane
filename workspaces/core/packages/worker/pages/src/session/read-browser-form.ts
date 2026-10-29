import type { WorkerSettings } from '@mechane/bindings';
import { HttpHeader } from '@mechane/records';
import { Effect } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';

type ReadBrowserFormInput = { readonly request: Request; readonly settings: WorkerSettings };

/** Only this deployment's origin may submit a browser form, and malformed bodies receive the same refusal. */
export const readBrowserForm = Effect.fn('readBrowserForm')(function* ({
  request,
  settings,
}: ReadBrowserFormInput): Effect.fn.Return<FormData, PageRefused> {
  if (request.headers.get(HttpHeader.Origin) !== settings.origin.origin) {
    return yield* new PageRefused({ refusal: PageRefusal.ForgedForm });
  }

  return yield* Effect.tryPromise({
    try: () => request.formData(),
    catch: () => new PageRefused({ refusal: PageRefusal.ForgedForm }),
  });
});
