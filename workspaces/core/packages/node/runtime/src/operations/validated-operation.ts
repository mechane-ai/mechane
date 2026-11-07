import { KeyMissing, RequestInvalid } from '@mechane/protocol';
import type { Operation, OperationInput } from '@mechane/protocol';
import { Schema } from 'effect';
import type { AuthCaller, AuthenticatedCaller, OperationHandler, TypedOperationContext } from './types.ts';

type ValidatedOperationInput<Declaration extends Operation> = {
  readonly operation: Declaration;
  readonly run: (context: TypedOperationContext<Declaration>) => Promise<unknown>;
};

// TypeScript cannot infer the intersection carried by a generic operation's three runtime schemas.
// ast-grep-ignore: type-predicate
function isInput<Definition extends Operation>(entry: Definition, input: object): input is OperationInput<Definition> {
  return Schema.is(entry.params)(input) && Schema.is(entry.query)(input) && Schema.is(entry.body)(input);
}

export function validatedOperation<Declaration extends Operation>({
  operation,
  run,
}: ValidatedOperationInput<Declaration>): OperationHandler {
  return async ({ input, caller }) => {
    if (!isInput(operation, input)) {
      throw new RequestInvalid({ reason: 'The operation input does not match its declaration' });
    }

    return await run({ input, caller });
  };
}

export function requireAuthenticated(caller: AuthCaller): AuthenticatedCaller {
  if (caller.authKind === 'public') {
    throw new KeyMissing({});
  }

  return caller;
}
