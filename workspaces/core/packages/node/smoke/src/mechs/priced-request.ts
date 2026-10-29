import { RATE_TOKENS } from '@mechane/deployment';
import { Tokens } from '@mechane/records';
import type { Stack } from '@mechane/stack';
import type { MechTurn } from '@mechane/testing';
import type { Charge } from './types.ts';

type RequestInput = { readonly stack: Stack; readonly request: MechTurn['requests'][number] };

/** The charge the ledger must make for a request: its reported tokens at the echo offer's rates, rounded up once. */
export function pricedRequest({ stack, request }: RequestInput): Charge {
  const offer = stack.modelUpstream.offers.echo;
  const { promptTokens, completionTokens } = request;

  const total =
    promptTokens * offer.inputMicrosPerMillionTokens + completionTokens * offer.outputMicrosPerMillionTokens;

  return {
    inputTokens: Tokens.make(promptTokens),
    outputTokens: Tokens.make(completionTokens),
    settledMicros: Math.ceil(total / RATE_TOKENS),
  };
}
