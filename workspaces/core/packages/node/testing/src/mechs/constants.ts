import { Duration } from 'effect';

/** The sequence a follower reads after to read a log from its first event. */
export const LOG_START = 0;

/** The tools the scenarios script, by the names the Worker offers them under. */
export const ScriptedTool = {
  MemoryWrite: 'memory_write',
  MemoryRead: 'memory_read',
  Handoff: 'handoff',
  OpenThread: 'open_thread',
  StartDrone: 'start_drone',
} as const;

/** How many random bytes tell a scenario's text from any other. */
export const TEXT_BYTES = 8;

/** How often the gated command looks for the open file, and how often the scenario reads its runs. */
export const GATE_POLL_INTERVAL = Duration.millis(100);
