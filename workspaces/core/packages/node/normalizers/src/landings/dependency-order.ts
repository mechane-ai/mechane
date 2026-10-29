import type { Unit } from '@mechane/modules';
import { readyUnits } from './ready-units.ts';
import type { LandingOrder } from './types.ts';

/** The units still to order, those ordered already, and those of the first that name none of the others. */
type OrderState = {
  readonly remaining: ReadonlyArray<Unit>;
  readonly ordered: ReadonlyArray<Unit>;
  readonly ready: ReadonlyArray<Unit>;
};

/** The units landing in one file, in their listed order. */
type DependencyOrderInput = { readonly units: ReadonlyArray<Unit> };

/** The state ordering is in. */
type NextOrderInput = { readonly state: OrderState };

/**
 * The units with each one after the landing units it names, in their listed order where none does. Units that name each
 * other land in their listed order, out of order.
 */
export function dependencyOrder({ units }: DependencyOrderInput): LandingOrder {
  let state: OrderState = { remaining: units, ordered: [], ready: readyUnits({ units }) };

  while (state.ready.length > 0) {
    state = nextOrder({ state });
  }

  return { units: [...state.ordered, ...state.remaining], cyclic: new Set(state.remaining.map(({ name }) => name)) };
}

/** The state once the ready units are ordered. */
function nextOrder({ state }: NextOrderInput): OrderState {
  /** Whether the unit is still to order. */
  const isRemaining: (unit: Unit) => boolean = (unit) => !state.ready.includes(unit);
  const remaining = state.remaining.filter(isRemaining);

  return { remaining, ordered: [...state.ordered, ...state.ready], ready: readyUnits({ units: remaining }) };
}
