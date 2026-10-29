import { CONTRACTS } from '@mechane/rules';

/** The words that name when a thing came rather than what it holds, which no name may use (NM-02). */
export const HISTORY_WORDS: ReadonlySet<string> = new Set(CONTRACTS['code-domain-vocabulary'].values.historyWords);

/** The function that makes an `Effect.fn`, as the source writes it. */
export const EFFECT_FUNCTION = 'Effect.fn';
