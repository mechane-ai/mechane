import type { MechTables } from '@mechane/mech-store';
import type { DateTime } from 'effect';

/** The mech's tables a port's decision runs on, and the instant its call read the clock at. */
export type PortDecisionInput = { readonly store: MechTables; readonly now: DateTime.Utc };
