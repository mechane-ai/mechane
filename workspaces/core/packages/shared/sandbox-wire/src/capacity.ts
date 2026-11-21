import { Schema } from 'effect';

const CapacityReason = { Disabled: 'disabled', Capacity: 'capacity', Stale: 'stale' } as const;

export const SandboxCapacityRefusalReason = Schema.Enum(CapacityReason);
export type SandboxCapacityRefusalReason = typeof SandboxCapacityRefusalReason.Type;
