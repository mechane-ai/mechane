import { hasPrincipalIdentity } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { InstallationAdministratorRequired } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { Caller } from '../types.ts';

type RequireInstallationAdministratorInput = { readonly settings: WorkerSettings; readonly caller: Caller };

/** Workspace owners cannot create additional budget-bearing workspaces unless the operator explicitly permits it. */
export const requireInstallationAdministrator = Effect.fn('requireInstallationAdministrator')(function* ({
  settings,
  caller,
}: RequireInstallationAdministratorInput): Effect.fn.Return<
  void,
  InstallationAdministratorRequired | ObjectUnavailable
> {
  if (Option.isNone(settings.administratorIdentities)) {
    return yield* new InstallationAdministratorRequired({});
  }

  const isAdministrator = yield* hasPrincipalIdentity({
    settings,
    principalId: caller.principal.id,
    identities: settings.administratorIdentities.value,
  });

  if (!isAdministrator) {
    return yield* new InstallationAdministratorRequired({});
  }
});
