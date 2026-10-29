import type { Unit } from '@mechane/modules';
import { valueNames } from './value-names.ts';

/** The units still to order. */
type ReadyUnitsInput = { readonly units: ReadonlyArray<Unit> };

/** The units that name no other unit still to order. */
export function readyUnits({ units }: ReadyUnitsInput): ReadonlyArray<Unit> {
  const pending: ReadonlySet<string> = new Set(units.map(({ name }) => name));

  /** Whether every name the unit reads is its own or one no unit still to order declares. */
  const isReady: (unit: Unit) => boolean = (unit) => {
    /** Whether the unit may read the name now. */
    const isFree: (name: string) => boolean = (name) => name === unit.name || !pending.has(name);

    return [...valueNames({ unit })].every(isFree);
  };

  return units.filter(isReady);
}
