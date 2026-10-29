import { Schema } from 'effect';
import { objectBindings } from './object-bindings.ts';
import { MechVariables } from './schemas.ts';
import type { DecodeSettingsInput, ObjectSettings } from './types.ts';

/**
 * Decodes the environment a mech's object receives, once, as the object opens; variables that do not decode fail the
 * open, which the object's fallback alarm retries.
 */
export function objectSettings({ environment }: DecodeSettingsInput): ObjectSettings {
  // The deploy renders the variables from this schema, so one that does not decode fails the object's construction,
  // which readiness reports.
  return { ...Schema.decodeUnknownSync(MechVariables)(environment), ...objectBindings({ environment }) };
}
