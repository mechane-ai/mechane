import { MachineId, RecordText } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { containerGuest } from './container-guest.ts';
import type { ContainerProviderInput } from './types.ts';

/** Startup labels identify the actual instance before its guest finishes booting. */
export const CONTAINER_MACHINE_LABEL = 'mechane.machine';

type ContainerMachineInput = Pick<ContainerProviderInput, 'container'> & { readonly machineId: MachineId };
type IdentityFailureInput = Pick<ContainerMachineInput, 'machineId'> & { readonly reason: string };

class ContainerIdentityUnconfirmed extends Schema.TaggedError<ContainerIdentityUnconfirmed>()(
  'ContainerIdentityUnconfirmed',
  { machineId: MachineId, reason: RecordText },
) {}

/** A running instance must prove its identity before a start joins it or a stop retires it. */
export async function requireContainerMachine({ container, machineId }: ContainerMachineInput): Promise<boolean> {
  const inspected = await container.inspect();
  const instance = Option.fromNullishOr(inspected);

  if (Option.isNone(instance)) {
    return false;
  }

  const label = Option.fromUndefinedOr(instance.value.labels[CONTAINER_MACHINE_LABEL]);

  if (Option.isSome(label)) {
    if (label.value === machineId) {
      return true;
    }

    return identityFailure({ machineId, reason: 'running container belongs to a different machine' });
  }

  const guest = await containerGuest({ container });

  if (Option.isSome(guest) && (await guest.value.health({ machineId }))) {
    return true;
  }

  return identityFailure({ machineId, reason: 'running container has not proved its machine identity' });
}

function identityFailure({ machineId, reason }: IdentityFailureInput): never {
  const cause = new ContainerIdentityUnconfirmed({ machineId, reason });
  const failed = Result.fail(cause);

  return Result.getOrThrow(failed);
}
