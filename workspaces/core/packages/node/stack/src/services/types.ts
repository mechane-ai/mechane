import type { StackVariables } from '../types.ts';

/** A local service a stack serves, and the variables that point the Worker at it. */
export type LocalService<S> = { readonly service: S; readonly variables: StackVariables };
