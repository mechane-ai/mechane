import { Schema } from 'effect';

/** A provider response that cannot satisfy the sandbox protocol; its body and credentials are never included. */
export class TensorlakeRefused extends Schema.TaggedError<TensorlakeRefused>()('TensorlakeRefused', {
  url: Schema.URL,
  status: Schema.Int,
}) {}
