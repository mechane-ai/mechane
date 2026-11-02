import { WorkspacePolicy } from '@mechane/protocol';
import { LeaseDecision, MachineRefusal, sandboxIdentity, workspaceStub } from '@mechane/rpc';
import type { ObjectBindings } from '@mechane/rpc';
import { ReservationPhase } from '@mechane/sandbox-store';
import type { MachineReservation, SandboxStore } from '@mechane/sandbox-store';
import type { SandboxOwner } from '@mechane/sandbox-wire';
import { serialCalls } from '@mechane/utilities';
import { Match, Option, Result, Schema } from 'effect';
import type { MachineIdInput, MachineProvider } from '../types.ts';

/** Converted to plain refusal data only at the sandbox RPC boundary. */
export class MachineAccessDenied extends Schema.TaggedError<MachineAccessDenied>()('MachineAccessDenied', {
  refusal: MachineRefusal,
}) {}

class InvalidSandboxOwner extends Schema.TaggedError<InvalidSandboxOwner>()('InvalidSandboxOwner', {}) {}

type MachineCapacityInput = {
  readonly store: SandboxStore;
  readonly bindings: ObjectBindings;
  readonly identity: string;
  readonly provider: MachineProvider;
};

type BindOwnerInput = { readonly owner: SandboxOwner };
type HeldInput = { readonly held: MachineReservation };
type ReserveInput = HeldInput & { readonly isAdopting: boolean };
type GrantedInput = { readonly decision: LeaseDecision };

type MachineCapacity = {
  readonly provider: MachineProvider;
  readonly bindOwner: (input: BindOwnerInput) => Promise<boolean>;
  readonly requireEnabled: () => Promise<void>;
  /** Absent before allocation and after both stop and release acknowledge completion. */
  readonly reservation: () => Option.Option<MachineReservation>;
};

/** The sandbox coordinates capacity across all machine users. Workspace remains the admission authority. */
export function machineCapacity({ store, bindings, identity, provider }: MachineCapacityInput): MachineCapacity {
  const calls = serialCalls();

  function owner(): SandboxOwner {
    const record = store.capacity();

    if (Option.isNone(record)) {
      const cause = new InvalidSandboxOwner({});
      const failure = Result.fail(cause);

      return Result.getOrThrow(failure);
    }

    return record.value.owner;
  }

  function reservation(): Option.Option<MachineReservation> {
    const record = store.capacity();

    return Option.flatMap(record, (value) => value.reservation);
  }

  function save({ held }: HeldInput): void {
    const value = Option.some(held);

    store.saveReservation({ reservation: value });
  }

  async function reserve({ held, isAdopting }: ReserveInput): Promise<LeaseDecision> {
    const identityOwner = owner();
    const sandboxId = Option.getOrElse(identityOwner.droneId, () => identityOwner.mechId);
    const workspace = workspaceStub({ bindings, workspaceId: identityOwner.workspaceId });
    const answer = await workspace.reserveMachine({ sandboxId, reservationId: held.reservationId, isAdopting });
    const decoded = Schema.decodeUnknownResult(LeaseDecision)(answer);

    return Result.getOrThrow(decoded);
  }

  async function bindOwner({ owner: identityOwner }: BindOwnerInput): Promise<boolean> {
    return await calls.run({
      run: async () => {
        const expected = sandboxIdentity({ bindings, owner: identityOwner }).toString();

        if (expected !== identity) {
          const cause = new InvalidSandboxOwner({});
          const failure = Result.fail(cause);

          return Result.getOrThrow(failure);
        }

        const existing = store.capacity();

        if (Option.isNone(existing)) {
          const latest = store.latestMachine();

          const adoption = Option.map(latest, (machine): MachineReservation => ({
            machineId: machine.id,
            reservationId: 1,
            phase: ReservationPhase.Adopting,
          }));

          store.bindCapacity({ owner: identityOwner, reservation: adoption });
        }

        const current = reservation();

        if (Option.isSome(current) && current.value.phase === ReservationPhase.Adopting) {
          const decision = await reserve({ held: current.value, isAdopting: true });

          assertGranted({ decision });
          save({ held: { ...current.value, phase: ReservationPhase.Held } });
        }

        return Option.isNone(existing);
      },
    });
  }

  async function requireEnabled(): Promise<void> {
    await calls.run({
      run: async () => {
        const identityOwner = owner();
        const workspace = workspaceStub({ bindings, workspaceId: identityOwner.workspaceId });
        const encoded = await workspace.policy({ initialAllowanceMicros: 0 });
        const decoded = Schema.decodeUnknownResult(WorkspacePolicy)(encoded);
        const policy = Result.getOrThrow(decoded);

        if (policy.isSuspended || !policy.hasSandboxes) {
          const decision = LeaseDecision.cases.Disabled.make({});

          assertGranted({ decision });
        }

        const held = reservation();

        if (Option.isNone(held)) {
          return;
        }

        if (held.value.phase === ReservationPhase.Stopping) {
          await stopReservation({ held: held.value });

          return;
        }

        const decision = await reserve({ held: held.value, isAdopting: false });

        assertGranted({ decision });
      },
    });
  }

  async function stopReservation({ held }: HeldInput): Promise<void> {
    // Keep the intent through both acknowledgements. A restart retries the stop and its fenced release.
    save({ held: { ...held, phase: ReservationPhase.Stopping } });
    await provider.stop({ machineId: held.machineId });

    const identityOwner = owner();
    const sandboxId = Option.getOrElse(identityOwner.droneId, () => identityOwner.mechId);
    const workspace = workspaceStub({ bindings, workspaceId: identityOwner.workspaceId });

    await workspace.releaseMachine({ sandboxId, reservationId: held.reservationId });

    const empty = Option.none();

    store.saveReservation({ reservation: empty });
  }

  async function start({ machineId }: MachineIdInput): Promise<void> {
    await calls.run({
      run: async () => {
        let current = reservation();

        if (Option.isSome(current) && current.value.phase === ReservationPhase.Stopping) {
          await stopReservation({ held: current.value });

          current = Option.none();
        }

        const held: MachineReservation = Option.getOrElse(current, () => ({
          reservationId: store.nextReservation(),
          machineId,
          phase: ReservationPhase.Starting,
        }));

        if (Option.isNone(current)) {
          // Unknown RPC outcomes keep this intent; the alarm can stop and release it safely.
          save({ held });
        }

        const decision = await reserve({ held, isAdopting: false });

        if (!LeaseDecision.guards.Leased(decision)) {
          if (Option.isNone(current)) {
            await stopReservation({ held });
          }

          assertGranted({ decision });
        }

        if (held.machineId === machineId && held.phase === ReservationPhase.Held) {
          return;
        }

        if (held.machineId !== machineId) {
          // Replacements reuse capacity, but the old machine must stop before a second one starts.
          await provider.stop({ machineId: held.machineId });
        }

        save({ held: { ...held, machineId, phase: ReservationPhase.Starting } });
        await provider.start({ machineId });
        save({ held: { ...held, machineId, phase: ReservationPhase.Held } });
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

          // An old stop must not destroy a newer machine in the same Cloudflare container slot.
          return;
        }

        await provider.stop({ machineId });
      },
    });
  }

  const accounted: MachineProvider = { start, connect: provider.connect, stop };

  return { provider: accounted, bindOwner, requireEnabled, reservation };
}

function assertGranted({ decision }: GrantedInput): void {
  if (LeaseDecision.guards.Leased(decision)) {
    return;
  }

  const refusal = Match.valueTags(decision, {
    Disabled: () => MachineRefusal.cases.Disabled.make({}),
    Full: () => MachineRefusal.cases.CapacityReached.make({}),
  });

  const cause = new MachineAccessDenied({ refusal });
  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}
