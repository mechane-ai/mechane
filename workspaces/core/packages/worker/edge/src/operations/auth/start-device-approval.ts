import { callDirectory, limitAddress } from '@mechane/bindings';
import { issueToken, issueUserCode, tokenHash } from '@mechane/credentials';
import { LimitPolicy } from '@mechane/deployment';
import { deviceUrl, TokenPrefix } from '@mechane/protocol';
import type { catalog, DeviceApproval, ObjectUnavailable, RateLimited } from '@mechane/protocol';
import { Duration, Effect, Option, Redacted, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** A start's request and peer, with the code and poll token it issued, which the directory records. */
type OpenApprovalInput = Omit<WorkInput<typeof catalog.startDeviceApproval>, 'caller'> & {
  readonly userCode: string;
  readonly pollToken: string;
};

/** How long a started device approval waits for a browser's approval and its poll's claim. */
const DEVICE_APPROVAL_LIFETIME = Duration.minutes(10);

/**
 * Opens a device approval for a login or a named key, under the limit of starts of the peer's address. It answers with
 * the device page and the code to type there.
 */
export const startDeviceApproval = Effect.fn('startDeviceApproval')(function* ({
  input,
  settings,
  peer,
}: WorkInput<typeof catalog.startDeviceApproval>): Effect.fn.Return<DeviceApproval, ObjectUnavailable | RateLimited> {
  const userCode = issueUserCode();
  const pollToken = issueToken({ prefix: TokenPrefix.Poll });

  yield* limitAddress({ settings, policy: LimitPolicy.DeviceStart, address: peer.address });
  yield* openApproval({ input, settings, peer, userCode, pollToken });

  return {
    userCode,
    verificationUrl: deviceUrl({ origin: settings.origin }),
    pollToken: Redacted.make(pollToken),
    interval: Duration.seconds(settings.approvalPollIntervalSeconds),
    expiresIn: DEVICE_APPROVAL_LIFETIME,
  };
});

/**
 * Records the approval with the key lifetime its purpose has now; the directory keeps only the poll token's hash, and
 * the peer's address and country for the device page's review.
 */
const openApproval = Effect.fn('openApproval')(function* ({
  input,
  settings,
  peer,
  userCode,
  pollToken,
}: OpenApprovalInput): Effect.fn.Return<void, ObjectUnavailable> {
  const pollTokenHash = yield* tokenHash({ token: pollToken });

  const approval = {
    id: crypto.randomUUID(),
    userCode,
    pollTokenHash,
    purpose: input.purpose,
    keyName: input.name,
    keyLifetimeMs: Duration.toMillis(settings.keyLifetimes[input.purpose]),
    peerAddress: Option.getOrNull(peer.address),
    peerCountry: Option.getOrNull(peer.country),
  };

  const lifetimeMs = Duration.toMillis(DEVICE_APPROVAL_LIFETIME);

  yield* callDirectory({
    settings,
    call: ({ directory }) => directory.openDeviceApproval({ approval, lifetimeMs }),
    answer: Schema.Undefined,
  });
});
