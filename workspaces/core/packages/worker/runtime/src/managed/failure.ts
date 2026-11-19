import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';

export class ManagedRuntimeError extends Schema.TaggedError<ManagedRuntimeError>()('ManagedRuntimeError', {
  status: Schema.Int,
  reason: Schema.String,
}) {
  constructor(
    input: { readonly status: number; readonly message: string } | { readonly status: number; readonly reason: string },
  ) {
    if ('reason' in input) {
      super(input);
    } else {
      super({ status: input.status, reason: input.message });
    }
  }

  override get message(): string {
    return this.reason;
  }
}

export const ManagedRuntimeFailureWire = Schema.TaggedStruct('ManagedRuntimeError', {
  status: Schema.Int,
  message: Schema.String,
});

export function failManagedRequest(status: HttpStatusCode, reason: string): never {
  throw new ManagedRuntimeError({ status, reason });
}

export function decodeManagedInput<T>(schema: Schema.Codec<T, unknown>, input: unknown): T {
  const result = Schema.decodeUnknownResult(schema)(input);

  if (result._tag === 'Success') {
    return result.success;
  }

  return failManagedRequest(HttpStatusCode.BadRequest, 'Invalid managed agent operation input');
}
