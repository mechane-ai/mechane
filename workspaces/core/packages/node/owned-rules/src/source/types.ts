import type { LogicalExpression } from 'oxc-parser';

/** An outermost chain of logical operators, and how many operators its count holds. */
export type CountedChain = { readonly chain: LogicalExpression; readonly count: number };
