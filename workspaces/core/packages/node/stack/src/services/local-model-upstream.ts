import { ModelOffersVariable } from '@mechane/deployment';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../errors.ts';
import { startScriptedUpstream } from '../model/start-scripted-upstream.ts';
import type { ScriptedUpstream } from '../types.ts';
import type { LocalService } from './types.ts';

/** Starts the scripted model upstream, and answers with it and the variables that stage its URL, key and offers. */
export const localModelUpstream = Effect.fn('localModelUpstream')(function* (): Effect.fn.Return<
  LocalService<ScriptedUpstream>,
  StackFailed,
  Scope.Scope
> {
  const upstream = yield* startScriptedUpstream();

  return {
    service: upstream,
    variables: {
      modelUpstream: upstream.upstream.href,
      modelApiKey: upstream.apiKey,
      // The offers are typed, so encoding them cannot fail; the echo comes first, so a mech gets it by default.
      modelOffers: Schema.encodeSync(ModelOffersVariable)([upstream.offers.echo, upstream.offers.costly]),
    },
  };
});
