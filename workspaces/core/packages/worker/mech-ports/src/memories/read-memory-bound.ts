import type { MechMemory } from '@mechane/harness-tools';
import type { MechTables, SessionIdInput } from '@mechane/mech-store';
import { Match, Option } from 'effect';

/** The conversation a memory call comes from: the mech's own, or a drone's. */
type ConversationRole = Parameters<MechMemory['read']>[0]['role'];

/** The tables a memory read runs on, and the conversation it comes from. */
type ReadMemoryBoundInput = { readonly store: MechTables; readonly role: ConversationRole };

/**
 * The saved version a conversation reads memory through: none for the mech's own, which reads its running turn's
 * memory, and the version a drone started at for a drone's.
 */
export function readMemoryBound({ store, role }: ReadMemoryBoundInput): Option.Option<number> {
  const droneBound: (drone: SessionIdInput) => Option.Option<number> = ({ sessionId }) =>
    Option.some(store.sessionDrone({ sessionId }).memoryVersion);

  return Match.valueTags(role, { Mech: () => Option.none(), Drone: droneBound });
}
