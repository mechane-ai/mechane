import type { RuntimeBindings } from './types.ts';

/** Bind an incoming request to the named actor that actually received it. */
export function ownsActorAddress({
  state,
  bindings,
  name,
}: {
  readonly state: Pick<DurableObjectState, 'id'>;
  readonly bindings: RuntimeBindings;
  readonly name: string;
}): boolean {
  return state.id.equals(bindings.MECHS.idFromName(name));
}
