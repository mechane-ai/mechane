import { HttpStatusCode } from '@mechane/records';
import { AllocationPhase, managedAllocationStore } from '@mechane/sandbox-store';
import type { ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { serialCalls } from '@mechane/utilities';
import { Option, Schema } from 'effect';

type Generation = { readonly generation: number };
type ScopedEffect<T> = Generation & { readonly run: () => Promise<T> };
type StartClaim = Generation & { readonly claim: ManagedWorkerClaim };

type MachineLifecycle = {
  readonly storage: Pick<DurableObjectStorage, 'get' | 'put'>;
  readonly start: (claim: ManagedWorkerClaim, beforeHandoff: () => Promise<void>) => Promise<number>;
  readonly observed: (claim: ManagedWorkerClaim) => Promise<boolean>;
  readonly touch: () => Promise<boolean>;
  readonly release: () => Promise<boolean>;
  readonly destroy: () => Promise<boolean>;
};

export class ManagedAllocationInactive extends Schema.TaggedError<ManagedAllocationInactive>()(
  'ManagedAllocationInactive',
  {},
) {
  override readonly message = 'Managed sandbox allocation is inactive';
}

/** Persist the generation before touching compute. A delayed launch cannot revive a released reservation. */
export function createManagedMachineController(lifecycle: MachineLifecycle) {
  const calls = serialCalls();
  const allocation = managedAllocationStore({ storage: lifecycle.storage });

  type Current = Awaited<ReturnType<typeof allocation.read>>;

  async function changeAllocation<T>(apply: (current: Current) => Promise<T>): Promise<T> {
    return await calls.run({
      run: async () => {
        const current = await allocation.read();

        return await apply(current);
      },
    });
  }

  function hasState(current: Current, generation: number, expected: AllocationPhase): boolean {
    return Option.exists(current, (held) => held.generation === generation && held.state === expected);
  }

  async function withState<T>(expected: AllocationPhase, { generation, run }: ScopedEffect<T>): Promise<T> {
    return await changeAllocation(async (current) => {
      if (!hasState(current, generation, expected)) {
        throw new ManagedAllocationInactive();
      }

      return await run();
    });
  }

  return {
    async isActive({ generation }: Generation): Promise<boolean> {
      const current = await allocation.read();

      return hasState(current, generation, AllocationPhase.Active);
    },
    withActive: async <T>(effect: ScopedEffect<T>): Promise<T> => await withState(AllocationPhase.Active, effect),
    withRelease: async <T>(effect: ScopedEffect<T>): Promise<T> => await withState(AllocationPhase.Releasing, effect),
    async start({ generation, claim }: StartClaim): Promise<number> {
      return await changeAllocation(async (current) => {
        if (Option.isSome(current)) {
          const held = current.value;

          if (held.state === AllocationPhase.Active && held.generation === generation) {
            // A lost reply may follow a completed tool effect. Only the original worker can acknowledge it again.
            if (await lifecycle.observed(claim)) {
              return HttpStatusCode.Accepted;
            }

            return HttpStatusCode.Unavailable;
          }

          const repeated = held.state === AllocationPhase.Preparing && held.generation === generation;
          const next = held.state === AllocationPhase.Released && held.generation < generation;

          if (!repeated && !next) {
            return HttpStatusCode.Conflict;
          }
        }

        await allocation.save({ generation, state: AllocationPhase.Preparing });

        return await lifecycle.start(claim, () => allocation.save({ generation, state: AllocationPhase.Active }));
      });
    },
    async touch({ generation }: Generation): Promise<number> {
      return await changeAllocation(async (current) => {
        if (!hasState(current, generation, AllocationPhase.Active)) {
          return HttpStatusCode.Conflict;
        }

        if (await lifecycle.touch()) {
          return HttpStatusCode.NoContent;
        }

        return HttpStatusCode.Unavailable;
      });
    },
    async release({ generation }: Generation): Promise<number> {
      return await changeAllocation(async (current) => {
        if (Option.isSome(current)) {
          const held = current.value;

          if (held.state === AllocationPhase.Retired || held.generation > generation) {
            return HttpStatusCode.NoContent;
          }

          const newerRequest = held.generation < generation && held.state !== AllocationPhase.Released;

          if (held.state === AllocationPhase.Retiring || newerRequest) {
            return HttpStatusCode.Conflict;
          }

          if (held.generation === generation && held.state === AllocationPhase.Released) {
            return HttpStatusCode.NoContent;
          }
        }

        await allocation.save({ generation, state: AllocationPhase.Releasing });

        if (!(await lifecycle.release())) {
          return HttpStatusCode.Unavailable;
        }

        await allocation.save({ generation, state: AllocationPhase.Released });

        return HttpStatusCode.NoContent;
      });
    },
    async destroy(): Promise<number> {
      return await changeAllocation(async (current) => {
        if (Option.exists(current, (held) => held.state === AllocationPhase.Retired)) {
          return HttpStatusCode.NoContent;
        }

        const generation = Option.match(current, { onNone: () => 0, onSome: (held) => held.generation });

        await allocation.save({ generation, state: AllocationPhase.Retiring });

        if (!(await lifecycle.destroy())) {
          return HttpStatusCode.Accepted;
        }

        await allocation.save({ generation, state: AllocationPhase.Retired });

        return HttpStatusCode.NoContent;
      });
    },
  };
}
