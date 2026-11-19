import { ProcessIdentityReused } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { InstalledActionOrigin } from '@mechane/sandbox-wire';
import type { SandboxOwner } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { installedActionOriginMatches } from '../workspace/installed-session-identity.ts';

type Claim = Omit<Parameters<SandboxStore['claimProcess']>[0], 'origin'>;

type ClaimInput = {
  readonly store: SandboxStore;
  readonly owner: SandboxOwner;
  readonly claim: Claim;
  readonly generation: Option.Option<number>;
  readonly origin: Option.Option<typeof InstalledActionOrigin.Encoded>;
};

export function claimProcess({ store, owner, claim, generation, origin }: ClaimInput): void {
  if (Option.isNone(generation) && Option.isNone(origin)) {
    store.claimProcess(claim);

    return;
  }

  const wire = Option.getOrUndefined(origin);
  const decoded = Schema.decodeUnknownResult(InstalledActionOrigin)(wire);

  if (Result.isSuccess(decoded) && Option.isSome(generation)) {
    const provenance = decoded.success;

    const matches = installedActionOriginMatches({
      owner,
      generation: generation.value,
      actionId: claim.processId,
      origin: provenance,
    });

    if (matches) {
      store.claimProcess({ ...claim, origin: provenance });

      return;
    }
  }

  const reason = new ProcessIdentityReused({ processId: claim.processId });
  const rejected = Result.fail(reason);

  Result.getOrThrow(rejected);
}
