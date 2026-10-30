import { capturePromise } from '@mechane/utilities';
import { Redacted, Result, Schema } from 'effect';
import type { OperatorSecretName } from './constants.ts';
import { OperatorSecretUnavailable } from './errors.ts';
import type { SecretSource } from './secret-source.schemas.ts';
import type { SecretReader } from './types.ts';

type OperatorSecretReaderInput = { readonly source: SecretSource; readonly name: OperatorSecretName };

const SecretValue = Schema.RedactedFromValue(Schema.NonEmptyString);

/** Resolves a rotating secret binding on use and replaces provider diagnostics with its safe binding name. */
export function operatorSecretReader({ source, name }: OperatorSecretReaderInput): SecretReader<Redacted.Redacted> {
  const read: SecretReader<Redacted.Redacted> = async () => {
    if (Redacted.isRedacted(source)) {
      return source;
    }

    const get: () => Promise<unknown> = async () => {
      const value: unknown = Reflect.apply(source.get, source, []);

      return await value;
    };

    const pending = get();
    const settled = await capturePromise({ promise: pending });

    if (Result.isFailure(settled)) {
      const failure = new OperatorSecretUnavailable({ binding: name });
      const failed = Result.fail(failure);

      return Result.getOrThrow(failed);
    }

    const decoded = Schema.decodeUnknownResult(SecretValue)(settled.success);
    const checked = Result.mapError(decoded, () => new OperatorSecretUnavailable({ binding: name }));

    return Result.getOrThrow(checked);
  };

  return read;
}
