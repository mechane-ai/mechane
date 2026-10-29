import type { ModelOffer } from '@mechane/deployment';
import type { AbortObject } from '@mechane/harness';
import { SettlementBasis } from '@mechane/protocol';
import type { Settlement, TokenUsage } from '@mechane/protocol';
import type { DispatchRequest } from '@mechane/records';
import type { WorkspaceRpc } from '@mechane/rpc';
import { Option } from 'effect';
import { priceMicros } from './price-micros.ts';

/** A dispatch to settle in its workspace's ledger, its offer, the usage reported for it, and the object's reset. */
type SettleDispatchInput = {
  readonly workspace: DurableObjectStub<WorkspaceRpc>;
  readonly dispatch: DispatchRequest;
  readonly offer: ModelOffer;
  /** The usage the upstream reported for the dispatch, none when it reported no tokens. */
  readonly usage: Option.Option<TokenUsage>;
  readonly abortObject: AbortObject;
};

/**
 * Settles a dispatch once: at the usage the upstream reported, each kind of token at its offer's rate, or at its whole
 * reservation without any. A settlement the ledger did not take leaves the reservation held, so the object resets and
 * settles it at its next open.
 */
export async function settleDispatch({
  workspace,
  dispatch,
  offer,
  usage,
  abortObject,
}: SettleDispatchInput): Promise<void> {
  const usageSettlement: (reported: TokenUsage) => Settlement = (reported) => ({
    basis: SettlementBasis.Usage,
    settledMicros: priceMicros({
      charges: [
        { tokens: reported.inputTokens, microsPerMillionTokens: offer.inputMicrosPerMillionTokens },
        { tokens: reported.outputTokens, microsPerMillionTokens: offer.outputMicrosPerMillionTokens },
        { tokens: reported.cacheReadTokens, microsPerMillionTokens: offer.cacheReadMicrosPerMillionTokens },
        { tokens: reported.cacheWriteTokens, microsPerMillionTokens: offer.cacheWriteMicrosPerMillionTokens },
      ],
    }),
    usage: reported,
  });

  const settlement = Option.match(usage, {
    onNone: () => ({ basis: SettlementBasis.Reservation, settledMicros: dispatch.requestedMicros }),
    onSome: usageSettlement,
  });

  const reset: (cause: unknown) => void = (cause) =>
    abortObject({ operation: `settle dispatch ${dispatch.id}`, cause });

  await workspace.settleDispatch({ dispatchId: dispatch.id, settlement }).then(() => undefined, reset);
}
