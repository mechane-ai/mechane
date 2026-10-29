import { RATE_TOKENS } from '@mechane/deployment';
import { Micros } from '@mechane/records';

/** Tokens at a rate in micro-dollars per million tokens. */
type Charge = { readonly tokens: number; readonly microsPerMillionTokens: number };

type PriceMicrosInput = { readonly charges: ReadonlyArray<Charge> };

/**
 * What tokens cost at rates in micro-dollars per million tokens: summed exactly in integers, divided once, and rounded
 * up, so a charge never falls below its price.
 */
export function priceMicros({ charges }: PriceMicrosInput): Micros {
  const chargeTotal: (charge: Charge) => bigint = ({ tokens, microsPerMillionTokens }) =>
    BigInt(tokens) * BigInt(microsPerMillionTokens);

  const total = charges.map(chargeTotal).reduce((sum, charged) => sum + charged, 0n);
  const rateTokens = BigInt(RATE_TOKENS);

  return Micros.make(Number((total + rateTokens - 1n) / rateTokens));
}
