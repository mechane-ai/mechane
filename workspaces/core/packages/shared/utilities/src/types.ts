/** A promise, and what runs once it settles in the way the function names. */
export type SettleRunInput<A> = { readonly promise: Promise<A>; readonly run: () => void };
