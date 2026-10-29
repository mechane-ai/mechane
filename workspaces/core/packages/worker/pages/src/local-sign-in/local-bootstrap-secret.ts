import { LOOPBACK_HOSTS } from '@mechane/deployment';
import { Effect, Option } from 'effect';
import type { Redacted } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import type { PageInput } from '../types.ts';

/** Exposes the configured bootstrap secret only to a request for the deployment's exact loopback origin. */
export const localBootstrapSecret = Effect.fn('localBootstrapSecret')(function* ({
  settings,
  url,
}: PageInput): Effect.fn.Return<Redacted.Redacted, PageRefused> {
  if (url.origin !== settings.origin.origin || !LOOPBACK_HOSTS.has(url.hostname)) {
    return yield* new PageRefused({ refusal: PageRefusal.SignInUnavailable });
  }

  if (Option.isNone(settings.localBootstrapSecret)) {
    return yield* new PageRefused({ refusal: PageRefusal.SignInUnavailable });
  }

  return settings.localBootstrapSecret.value;
});
