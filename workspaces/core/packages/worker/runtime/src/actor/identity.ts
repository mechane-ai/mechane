import type { RuntimeBindings } from './types.ts';

type AddressInput = {
  readonly state: Pick<DurableObjectState, 'id'>;
  readonly bindings: RuntimeBindings;
  readonly name: string;
};

/** Bind an incoming request to the named session actor that actually received it. */
export function ownsSessionAddress({ state, bindings, name }: AddressInput): boolean {
  return state.id.equals(bindings.SESSIONS.idFromName(name));
}
