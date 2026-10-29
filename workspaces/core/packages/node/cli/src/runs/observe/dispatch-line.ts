import { DispatchStatus, SettlementBasis, UnknownDispatch } from '@mechane/protocol';
import type { Dispatch, TracedDispatch } from '@mechane/protocol';
import { Schema } from 'effect';
import { UNKNOWN_KIND_NOTE } from '../constants.ts';
import { TEXT_INDENT } from './constants.ts';

/** The status every settled dispatch has. */
type SettledStatus = { readonly status: typeof DispatchStatus.Settled };

type SettlementInput = { readonly dispatch: Extract<Dispatch, SettledStatus> };

type DispatchLineInput = { readonly dispatch: TracedDispatch };

/**
 * A dispatch: its model and the reservation it asked for, and how the allowance and its settlement answered it. A
 * dispatch in a status, or settled on a basis, that this release does not know shows its status alone.
 */
export function dispatchLine({ dispatch }: DispatchLineInput): string {
  if (Schema.is(UnknownDispatch)(dispatch)) {
    return `${TEXT_INDENT}dispatch ${dispatch.id} ${dispatch.model} asked ${dispatch.requested_micros} micro-dollars, ${dispatch.status}, ${UNKNOWN_KIND_NOTE}`;
  }

  const heading = `${TEXT_INDENT}dispatch ${dispatch.id} ${dispatch.model} asked ${dispatch.requestedMicros} micro-dollars`;

  switch (dispatch.status) {
    case DispatchStatus.Reserved:
      return `${heading}, reserved and not settled yet`;
    case DispatchStatus.Refused:
      return `${heading}, refused unsent: the allowance could not cover it`;
    case DispatchStatus.Settled:
      return `${heading}, ${settlement({ dispatch })}`;
  }
}

/** How a settled dispatch was charged: for its usage, or its whole reservation when the upstream reported none. */
function settlement({ dispatch }: SettlementInput): string {
  const charged = `charged ${dispatch.settledMicros} micro-dollars`;

  switch (dispatch.basis) {
    case SettlementBasis.Usage:
      return `${charged} for ${dispatch.inputTokens} input, ${dispatch.outputTokens} output, ${dispatch.cacheReadTokens} cache read and ${dispatch.cacheWriteTokens} cache write tokens`;
    case SettlementBasis.Reservation:
      return `${charged}, its whole reservation, as the upstream reported no usage`;
  }
}
