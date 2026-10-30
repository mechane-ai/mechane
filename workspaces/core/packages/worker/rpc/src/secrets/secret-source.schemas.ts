import { Predicate, Schema, SchemaTransformation } from 'effect';

const SecretStoreBinding = Schema.Struct({ get: Schema.declare(Predicate.isFunction) });
const isSecretStoreBinding = Schema.is(SecretStoreBinding);
const OpaqueSecretStoreBinding = Schema.declare(isSecretStoreBinding);

/** The owned tag distinguishes text from a binding without probing the binding for Effect's internal markers. */
export const SecretSourceValue = Schema.TaggedUnion({
  Text: { secret: Schema.Redacted(Schema.NonEmptyString) },
  Binding: { binding: OpaqueSecretStoreBinding },
});

export type SecretSourceValue = typeof SecretSourceValue.Type;

/** Tags keep native RPC bindings away from redacted-value detection while preserving the receiver of get(). */
export const SecretSource = Schema.Union([
  Schema.RedactedFromValue(Schema.NonEmptyString).pipe(
    Schema.decodeTo(
      SecretSourceValue.cases.Text,
      SchemaTransformation.transform({
        decode: (secret) => SecretSourceValue.cases.Text.make({ secret }),
        encode: (source) => source.secret,
      }),
    ),
  ),
  OpaqueSecretStoreBinding.pipe(
    Schema.decodeTo(
      SecretSourceValue.cases.Binding,
      SchemaTransformation.transform({
        decode: (binding) => SecretSourceValue.cases.Binding.make({ binding }),
        encode: (source) => source.binding,
      }),
    ),
  ),
]);

export type SecretSource = typeof SecretSource.Type;
