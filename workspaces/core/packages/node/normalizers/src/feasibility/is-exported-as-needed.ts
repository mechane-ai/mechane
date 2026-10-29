import type { Need, TopLevelName } from '@mechane/modules';

/** A need of a moving unit, and the declaration of its name in the unit's file. */
type IsExportedAsNeededInput = { readonly need: Need; readonly declared: TopLevelName };

/** Whether the unit's file exports a need's declaration as the need's import takes it: its value, or a type alone. */
export function isExportedAsNeeded({ need, declared }: IsExportedAsNeededInput): boolean {
  return declared.isValueExported || (need.isTypeOnly && declared.isExported);
}
