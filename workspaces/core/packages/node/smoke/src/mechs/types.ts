import type { TokenUsage } from '@mechane/protocol';

/** A charge as a scenario compares it: the input and output tokens it was priced from, and what it cost. */
export type Charge = Pick<TokenUsage, 'inputTokens' | 'outputTokens'> & { readonly settledMicros: number };
