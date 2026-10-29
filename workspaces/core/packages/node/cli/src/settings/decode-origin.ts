import { OriginInvalid, UsageInvalid } from '@mechane/cli-kernel';
import type { OutputMode } from '@mechane/commands';
import { SecureOrigin } from '@mechane/deployment';
import { Effect, Schema } from 'effect';

type DecodeOriginInput = { readonly text: string; readonly output: OutputMode };

/** The deployment origin, which a key goes to, so it must be an HTTPS URL or plain HTTP on a loopback host. */
export const decodeOrigin = Effect.fn('decodeOrigin')(function* ({
  text,
  output,
}: DecodeOriginInput): Effect.fn.Return<URL, UsageInvalid> {
  const originInvalid: (error: Schema.SchemaError) => UsageInvalid = (error) =>
    new UsageInvalid({ problem: new OriginInvalid({ origin: text, reason: error.message }), output });

  return yield* Schema.decodeUnknownEffect(SecureOrigin)(text).pipe(Effect.mapError(originInvalid));
});
