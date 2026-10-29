import { Result, Schema } from 'effect';
import { TensorlakeRefused } from './errors.ts';

type TensorlakeAnswerInput<S extends Schema.Codec<unknown, unknown>> = {
  readonly response: Response;
  readonly schema: S;
};

/** Decodes an external answer without including a provider's body in an exception. */
export async function tensorlakeAnswer<S extends Schema.Codec<unknown, unknown>>({
  response,
  schema,
}: TensorlakeAnswerInput<S>): Promise<S['Type']> {
  const body = await response.text();
  const wire = Schema.fromJsonString(schema);
  const decode = Schema.decodeUnknownResult(wire);
  const result = decode(body);

  if (Result.isFailure(result)) {
    const url = new URL(response.url);
    const failure = new TensorlakeRefused({ url, status: response.status });
    const refused = Result.fail(failure);

    return Result.getOrThrow(refused);
  }

  return result.success;
}
