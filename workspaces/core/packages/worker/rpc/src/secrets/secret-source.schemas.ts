import { Predicate, Schema } from 'effect';

const SecretStoreBinding = Schema.Struct({ get: Schema.declare(Predicate.isFunction) });
const isSecretStoreBinding = Schema.is(SecretStoreBinding);

/** Local text and hosted secret bindings share one reader; binding identity preserves the receiver of get(). */
export const SecretSource = Schema.Union([
  Schema.RedactedFromValue(Schema.NonEmptyString),
  Schema.declare(isSecretStoreBinding),
]);

export type SecretSource = typeof SecretSource.Type;
