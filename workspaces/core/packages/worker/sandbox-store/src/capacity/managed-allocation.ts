import { decodeOptionalStoredValue } from '@mechane/store';
import type { Option } from 'effect';
import { Schema } from 'effect';

const ALLOCATION_KEY = 'managed-worker-allocation';

export const AllocationPhase = {
  Preparing: 'preparing',
  Active: 'active',
  Releasing: 'releasing',
  Released: 'released',
  Retiring: 'retiring',
  Retired: 'retired',
} as const;

export type AllocationPhase = (typeof AllocationPhase)[keyof typeof AllocationPhase];

const Allocation = Schema.Struct({ generation: Schema.Int, state: Schema.Enum(AllocationPhase) });
type Allocation = typeof Allocation.Type;

type StoreInput = { readonly storage: Pick<DurableObjectStorage, 'get' | 'put'> };

type AllocationStore = {
  readonly read: () => Promise<Option.Option<Allocation>>;
  readonly save: (allocation: Allocation) => Promise<void>;
};

export function managedAllocationStore({ storage }: StoreInput): AllocationStore {
  return {
    read: async () => {
      const stored = await storage.get(ALLOCATION_KEY);

      return decodeOptionalStoredValue({ value: stored, schema: Allocation });
    },
    save: async ({ generation, state }) => {
      await storage.put(ALLOCATION_KEY, { generation, state });
    },
  };
}
