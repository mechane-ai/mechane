import type { SourceFence } from '@mechane/sandbox-store';

/** The source phase and diagnostic chosen before the completed transition is stored. */
export type SourceOutcome = Pick<SourceFence, 'phase' | 'reason'>;
