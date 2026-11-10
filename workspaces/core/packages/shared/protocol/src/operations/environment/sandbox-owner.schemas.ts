import { MechId, wireStruct } from '@mechane/records';
import { SandboxCapacityIdentity } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

/** Passive service-authenticated inventory used to drain owned machines before shutdown. */
export const SANDBOX_OWNERS_PATH = '/internal/sandbox-owners';

/** Cursor into the canonical active-capacity inventory. */
export const SandboxOwnerQuery = wireStruct({
  fields: {
    /** None starts before the first owner. */
    afterMechId: Schema.OptionFromOptionalKey(MechId),
  },
});

/** Native JSON inventory; reading a page never allocates or renews a machine. */
export const SandboxOwnerPage = Schema.Struct({
  owners: Schema.Array(SandboxCapacityIdentity),
  hasMore: Schema.Boolean,
  /** Null when no later owner remains. */
  nextAfterMechId: Schema.NullOr(MechId),
});

export type SandboxOwnerPage = typeof SandboxOwnerPage.Type;
