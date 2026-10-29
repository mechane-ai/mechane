/**
 * How a statement stands among its neighbors. Control flow, a return, a throw and a multi-line declaration or
 * expression statement stand apart, as does a call, `new`, `void`, `await` or `yield*` statement except beside another
 * call. An overload signature takes no blank line after it, and a loose statement takes one only where a neighbor needs
 * it.
 */
export const Spacing = { Apart: 'apart', Call: 'call', Overload: 'overload', Loose: 'loose' } as const;

export type Spacing = (typeof Spacing)[keyof typeof Spacing];
