import type { MechStorageInput } from './types.ts';

/**
 * Deletes the object's whole database, pi's tables and both migration ledgers with it, so the store and pi's Harness
 * open on it anew as on a new object's.
 */
export async function clearMechStorage({ storage }: MechStorageInput): Promise<void> {
  await storage.deleteAll();
}
