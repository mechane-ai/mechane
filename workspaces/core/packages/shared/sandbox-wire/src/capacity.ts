import { MachineId, Sequence } from '@mechane/records';
import { Schema } from 'effect';
import { SandboxOwner } from './sandbox-owner.ts';

export const SANDBOX_CAPACITY_PATH = '/internal/sandbox-capacity';
export const SandboxCapacityAction = { Acquire: 'acquire', Release: 'release' } as const;
export const SandboxCapacityStatus = { Acquired: 'acquired', Released: 'released', Refused: 'refused' } as const;
const CapacityReason = { Disabled: 'disabled', Capacity: 'capacity', Stale: 'stale' } as const;
const reservationBounds = Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const CapacityReservationId = Sequence.check(reservationBounds);

export const SandboxCapacityIdentity = Schema.Struct({
  ...SandboxOwner.fields,
  reservationId: CapacityReservationId,
  machineId: MachineId,
});

export type SandboxCapacityIdentity = typeof SandboxCapacityIdentity.Type;

export const SandboxCapacityRequest = Schema.Struct({
  ...SandboxCapacityIdentity.fields,
  action: Schema.Enum(SandboxCapacityAction),
});

export type SandboxCapacityRequest = typeof SandboxCapacityRequest.Type;

export const SandboxCapacityRefusalReason = Schema.Enum(CapacityReason);
export type SandboxCapacityRefusalReason = typeof SandboxCapacityRefusalReason.Type;

export const SandboxCapacityResult = Schema.Union([
  Schema.Struct({ status: Schema.Literals([SandboxCapacityStatus.Acquired, SandboxCapacityStatus.Released]) }),
  Schema.Struct({ status: Schema.Literal(SandboxCapacityStatus.Refused), reason: SandboxCapacityRefusalReason }),
]);

export type SandboxCapacityResult = typeof SandboxCapacityResult.Type;
