import { LOCAL_OWNER_IDENTITY } from '@mechane/records';
import { Effect, Record, Schema } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import { openBrowserSession } from '../session/open-browser-session.ts';
import { readBrowserForm } from '../session/read-browser-form.ts';
import type { PageFailure, PageInput } from '../types.ts';
import { localBootstrapSecret } from './local-bootstrap-secret.ts';
import { matchesBootstrapSecret } from './matches-bootstrap-secret.ts';

const BootstrapForm = Schema.Struct({ secret: Schema.RedactedFromValue(Schema.NonEmptyString) });

/** A matching local bootstrap secret opens the same browser session used by GitHub sign-in and device approval. */
export const submitLocalSignIn = Effect.fn('submitLocalSignIn')(function* (
  input: PageInput,
): Effect.fn.Return<Response, PageFailure> {
  const { request, settings } = input;
  const expected = yield* localBootstrapSecret(input);
  const fields = yield* readBrowserForm({ request, settings });

  const values = Record.fromEntries(fields);

  const form = yield* Schema.decodeUnknownEffect(BootstrapForm)(values).pipe(
    Effect.mapError(() => new PageRefused({ refusal: PageRefusal.BootstrapRefused })),
  );

  const isAccepted = yield* matchesBootstrapSecret({ expected, submitted: form.secret });

  if (!isAccepted) {
    return yield* new PageRefused({ refusal: PageRefusal.BootstrapRefused });
  }

  return yield* openBrowserSession({ settings, identity: LOCAL_OWNER_IDENTITY });
});
