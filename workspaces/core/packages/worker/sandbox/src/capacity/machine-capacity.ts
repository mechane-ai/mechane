import { ReservationPhase } from '@mechane/sandbox-store';
import type { MachineReservation, SandboxStore } from '@mechane/sandbox-store';
import { SandboxCapacityIdentity, SandboxCapacityRefusalReason, SandboxCapacityStatus } from '@mechane/sandbox-wire';
import type { SandboxOwner } from '@mechane/sandbox-wire';
import { capturePromise, serialCalls } from '@mechane/utilities';
import { DateTime, Option, Result, Schema } from 'effect';
import type { MachineIdInput, MachineProvider } from '../types.ts';
import type { CapacityClient } from './capacity-client.ts';

class InvalidSandboxOwner extends Schema.TaggedError<InvalidSandboxOwner>()('InvalidSandboxOwner', {}) {}

export class CapacityRefused extends Schema.TaggedError<CapacityRefused>()('CapacityRefused', {
  reason: SandboxCapacityRefusalReason,
}) {}

class CapacityReleaseFailed extends Schema.TaggedError<CapacityReleaseFailed>()('CapacityReleaseFailed', {}) {}

type MachineCapacityInput = {
  readonly store: SandboxStore;
  readonly provider: MachineProvider;
  readonly client: CapacityClient;
  readonly scheduleStopRetry: () => Promise<void>;
};

type BindOwnerInput = { readonly owner: SandboxOwner };
type HeldInput = { readonly held: MachineReservation };

type MachineCapacity = {
  readonly provider: MachineProvider;
  readonly bindOwner: (input: BindOwnerInput) => Promise<void>;
  readonly requireOwner: () => SandboxOwner;
  readonly reservation: () => Option.Option<MachineReservation>;
};

export function machineCapacity({ store, provider, client, scheduleStopRetry }: MachineCapacityInput): MachineCapacity {
  const calls = serialCalls();

  function requireOwner(): SandboxOwner {
    const capacity = store.capacity();

    if (Option.isNone(capacity)) {
      throw new InvalidSandboxOwner({});
    }

    return capacity.value.owner;
  }

  function reservation(): Option.Option<MachineReservation> {
    const capacity = store.capacity();

    return Option.flatMap(capacity, (value) => value.reservation);
  }

  function save({ held }: HeldInput): void {
    const savedReservation = Option.some(held);

    store.saveReservation({ reservation: savedReservation });
  }

  function identity({ held }: HeldInput): SandboxCapacityIdentity {
    const capacity = store.capacity();

    if (Option.isNone(capacity)) {
      throw new InvalidSandboxOwner({});
    }

    const decoded = Schema.decodeUnknownResult(SandboxCapacityIdentity)({
      ...capacity.value.owner,
      reservationId: held.reservationId,
      machineId: held.machineId,
    });

    return Result.getOrThrow(decoded);
  }

  async function bindOwner({ owner }: BindOwnerInput): Promise<void> {
    await calls.run({
      run: async () => {
        const existing = store.capacity();

        if (Option.isSome(existing)) {
          const previous = existing.value.owner;
          const matches = previous.workspaceId === owner.workspaceId && previous.mechId === owner.mechId;

          if (!matches) {
            throw new InvalidSandboxOwner({});
          }

          return;
        }

        const initialReservation = Option.none();

        store.bindCapacity({ owner, reservation: initialReservation });
      },
    });
  }

  async function stopReservation({ held }: HeldInput): Promise<void> {
    // A failed stop retains its intent, so another request cannot allocate a replacement prematurely.
    save({ held: { ...held, phase: ReservationPhase.Stopping } });
    await provider.stop({ machineId: held.machineId });

    const allocation = identity({ held });
    const released = await client.release(allocation);

    if (released.status !== SandboxCapacityStatus.Released) {
      throw new CapacityReleaseFailed({});
    }

    const clearedReservation = Option.none();

    store.saveReservation({ reservation: clearedReservation });
  }

  async function startReservation({ held }: HeldInput): Promise<void> {
    const allocation = identity({ held });
    const admitted = await client.acquire(allocation);

    if (admitted.status === SandboxCapacityStatus.Refused) {
      const now = DateTime.nowUnsafe();

      store.failMachine({ machineId: held.machineId, startupDeadline: now, now });

      const cleanup = stopReservation({ held });
      const stopped = await capturePromise({ promise: cleanup });

      if (Result.isFailure(stopped)) {
        // Durable Stopping intent owns cleanup after a refused start; the command itself never ran.
        await scheduleStopRetry();
      }

      throw new CapacityRefused({ reason: admitted.reason });
    }

    if (admitted.status !== SandboxCapacityStatus.Acquired) {
      throw new InvalidSandboxOwner({});
    }

    await provider.start({ machineId: held.machineId });
    save({ held: { ...held, phase: ReservationPhase.Held } });
  }

  async function start({ machineId }: MachineIdInput): Promise<void> {
    await calls.run({
      run: async () => {
        requireOwner();

        const previous = reservation();

        if (Option.isSome(previous)) {
          const held = previous.value;

          if (held.machineId === machineId && held.phase === ReservationPhase.Held) {
            return;
          }

          if (held.machineId === machineId && held.phase === ReservationPhase.Starting) {
            await startReservation({ held });

            return;
          }

          await stopReservation({ held });
        }

        const held: MachineReservation = {
          reservationId: store.nextReservation(),
          machineId,
          phase: ReservationPhase.Starting,
        };

        save({ held });
        await startReservation({ held });
      },
    });
  }

  async function stop({ machineId }: MachineIdInput): Promise<void> {
    await calls.run({
      run: async () => {
        const held = reservation();

        if (Option.isSome(held)) {
          if (held.value.machineId === machineId) {
            await stopReservation({ held: held.value });
          }

          // A delayed stop cannot destroy the replacement occupying this container slot.
          return;
        }

        await provider.stop({ machineId });
      },
    });
  }

  return {
    provider: {
      start,
      connect: provider.connect,
      stop,
      startupTimeout: provider.startupTimeout,
      isAbsent: provider.isAbsent,
    },
    bindOwner,
    requireOwner,
    reservation,
  };
}
