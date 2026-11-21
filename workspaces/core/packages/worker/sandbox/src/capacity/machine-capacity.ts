import { ReservationPhase } from '@mechane/sandbox-store';
import type { MachineReservation, SandboxStore } from '@mechane/sandbox-store';
import { SandboxCapacityRefusalReason } from '@mechane/sandbox-wire';
import type { SandboxOwner } from '@mechane/sandbox-wire';
import { serialCalls } from '@mechane/utilities';
import { Option, Schema } from 'effect';
import { observeNativeSnapshot } from '../machines/observe-native-snapshot.ts';
import type { MachineProvider, MachineStartInput, MachineStopInput } from '../types.ts';

class InvalidSandboxOwner extends Schema.TaggedError<InvalidSandboxOwner>()('InvalidSandboxOwner', {}) {}

export class CapacityRefused extends Schema.TaggedError<CapacityRefused>()('CapacityRefused', {
  reason: SandboxCapacityRefusalReason,
}) {}

class MachineStopUnconfirmed extends Schema.TaggedError<MachineStopUnconfirmed>()('MachineStopUnconfirmed', {}) {}

type MachineCapacityInput = {
  readonly store: SandboxStore;
  readonly provider: MachineProvider;
  readonly isAdmittingInstalled: () => boolean;
};

type BindOwnerInput = { readonly owner: SandboxOwner; readonly isInstalled: boolean };
type HeldInput = { readonly held: MachineReservation };

type MachineCapacity = {
  readonly provider: MachineProvider;
  readonly bindOwner: (input: BindOwnerInput) => Promise<void>;
  readonly requireOwner: () => SandboxOwner;
  readonly isInstalled: () => boolean;
  readonly reservation: () => Option.Option<MachineReservation>;
};

export function machineCapacity({ store, provider, isAdmittingInstalled }: MachineCapacityInput): MachineCapacity {
  const calls = serialCalls();

  function requireOwner(): SandboxOwner {
    const capacity = store.capacity();

    if (Option.isNone(capacity)) {
      throw new InvalidSandboxOwner({});
    }

    return capacity.value.owner;
  }

  function isInstalled(): boolean {
    const owner = store.capacity();

    return Option.exists(owner, (value) => value.owner.isInstalled === true);
  }

  function physicalCheckpoint({ checkpoint }: Pick<MachineStartInput, 'checkpoint'>): MachineStartInput['checkpoint'] {
    if (isInstalled()) {
      return Option.none();
    }

    return checkpoint;
  }

  function reservation(): Option.Option<MachineReservation> {
    const capacity = store.capacity();

    return Option.flatMap(capacity, (value) => value.reservation);
  }

  function save({ held }: HeldInput): void {
    const savedReservation = Option.some(held);

    store.saveReservation({ reservation: savedReservation });
  }

  async function bindOwner({ owner, isInstalled: installed }: BindOwnerInput): Promise<void> {
    await calls.run({
      run: async () => {
        const existing = store.capacity();

        if (Option.isSome(existing)) {
          const previous = existing.value.owner;
          const matches = previous.workspaceId === owner.workspaceId && previous.mechId === owner.mechId;

          if (!matches || (previous.isInstalled === true) !== installed) {
            throw new InvalidSandboxOwner({});
          }

          return;
        }

        const initialReservation = Option.none();

        if (installed) {
          store.bindCapacity({ owner: { ...owner, isInstalled: installed }, reservation: initialReservation });

          return;
        }

        store.bindCapacity({ owner, reservation: initialReservation });
      },
    });
  }

  async function stopReservation({
    held,
    checkpoint,
  }: HeldInput & Pick<MachineStopInput, 'checkpoint'>): Promise<void> {
    // A failed stop retains its intent, so another request cannot allocate a replacement prematurely.
    save({ held: { ...held, phase: ReservationPhase.Stopping } });

    try {
      const cache = physicalCheckpoint({ checkpoint });

      await provider.stop({ machineId: held.machineId, checkpoint: cache });
    } finally {
      await observeNativeSnapshot({ store, provider, machineId: held.machineId });
    }

    const isAbsent = await provider.isAbsent({ machineId: held.machineId });

    if (!isAbsent) {
      throw new MachineStopUnconfirmed({});
    }

    const clearedReservation = Option.none();

    store.saveReservation({ reservation: clearedReservation });
  }

  async function startReservation({
    held,
    checkpoint,
  }: HeldInput & Pick<MachineStartInput, 'checkpoint'>): Promise<void> {
    const cache = physicalCheckpoint({ checkpoint });

    await provider.start({ machineId: held.machineId, checkpoint: cache });
    save({ held: { ...held, phase: ReservationPhase.Held } });
  }

  async function start({ machineId, checkpoint }: MachineStartInput): Promise<void> {
    await calls.run({
      run: async () => {
        requireOwner();

        const previous = reservation();

        if (isInstalled() && !isAdmittingInstalled()) {
          if (Option.exists(previous, (held) => held.machineId === machineId && held.phase === ReservationPhase.Held)) {
            return;
          }

          throw new CapacityRefused({ reason: 'stale' });
        }

        if (Option.isSome(previous)) {
          const held = previous.value;

          if (held.machineId === machineId && held.phase === ReservationPhase.Held) {
            return;
          }

          if (held.machineId === machineId && held.phase === ReservationPhase.Starting) {
            await startReservation({ held, checkpoint });

            return;
          }

          const cacheCheckpoint = Option.none();

          await stopReservation({ held, checkpoint: cacheCheckpoint });
        }

        const held: MachineReservation = {
          reservationId: store.nextReservation(),
          machineId,
          phase: ReservationPhase.Starting,
        };

        save({ held });
        await startReservation({ held, checkpoint });
      },
    });
  }

  async function stop({ machineId, checkpoint }: MachineStopInput): Promise<void> {
    await calls.run({
      run: async () => {
        const held = reservation();

        if (Option.isSome(held)) {
          if (held.value.machineId === machineId) {
            await stopReservation({ held: held.value, checkpoint });
          }

          // A delayed stop cannot destroy the replacement occupying this container slot.
          return;
        }

        const cache = physicalCheckpoint({ checkpoint });

        await provider.stop({ machineId, checkpoint: cache });
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
      restoredWorkspace: async (input) => !isInstalled() && (await provider.restoredWorkspace(input)),
      snapshotReport: provider.snapshotReport,
    },
    bindOwner,
    requireOwner,
    isInstalled,
    reservation,
  };
}
