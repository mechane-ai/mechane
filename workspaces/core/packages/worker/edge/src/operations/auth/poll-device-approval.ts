import { callDirectory } from '@mechane/bindings';
import { issueToken, tokenHash } from '@mechane/credentials';
import { DeviceApprovalNotFound, PollStatus, TokenPrefix } from '@mechane/protocol';
import type { catalog, DeviceApprovalPoll, ObjectUnavailable } from '@mechane/protocol';
import { ApprovalClaim } from '@mechane/rpc';
import { Effect, Match, Redacted } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/**
 * Claims the device approval of the poll token: once a browser approved it, the claim mints its key. This answer is the
 * only place the key's token ever appears, since the directory stores only its hash.
 */
export const pollDeviceApproval = Effect.fn('pollDeviceApproval')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.pollDeviceApproval>): Effect.fn.Return<
  DeviceApprovalPoll,
  DeviceApprovalNotFound | ObjectUnavailable
> {
  const keyToken = issueToken({ prefix: TokenPrefix.Key });
  const keyId = crypto.randomUUID();
  const pollTokenHash = yield* tokenHash({ token: Redacted.value(input.pollToken) });
  const keyTokenHash = yield* tokenHash({ token: keyToken });

  const claim = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.claimDeviceApproval({ pollTokenHash, keyId, keyTokenHash }),
    answer: ApprovalClaim,
  });

  const token = Redacted.make(keyToken);

  return yield* Match.valueTags(claim, {
    Pending: () => Effect.succeed({ status: PollStatus.Pending }),
    Claimed: ({ key, principal }) => Effect.succeed({ status: PollStatus.Approved, token, key, principal }),
    Unclaimable: () => new DeviceApprovalNotFound(),
  });
});
