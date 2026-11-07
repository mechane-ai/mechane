import type { catalog, Operation, OperationInput, OperationName } from '@mechane/protocol';

export type AuthCaller =
  | { readonly authKind: 'public'; readonly principalId: null; readonly keyId: null }
  | { readonly authKind: 'session'; readonly principalId: string; readonly keyId: null }
  | { readonly authKind: 'key'; readonly principalId: string; readonly keyId: string };

export type AuthenticatedCaller = Exclude<AuthCaller, { readonly authKind: 'public' }>;

export type OperationContext = { readonly input: object; readonly caller: AuthCaller };

export type NamedOperationContext = OperationContext & { readonly name: OperationName };

export type TypedOperationContext<Declaration extends Operation> = {
  readonly input: OperationInput<Declaration>;
  readonly caller: AuthCaller;
};

export type OperationHandler = (context: OperationContext) => Promise<unknown>;

export type OperationHandlers = { readonly [Name in keyof typeof catalog]: OperationHandler };
