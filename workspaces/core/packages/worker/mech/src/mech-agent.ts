import type { MechAgent } from '@mechane/harness';
import type { MechRevisionRow } from '@mechane/mech-store';

type MechInput = { readonly mech: MechRevisionRow };

/** The definition held for the current turn and its drones. */
export function mechAgent({ mech }: MechInput): MechAgent {
  return { modelId: mech.model, instructions: mech.instructions };
}
