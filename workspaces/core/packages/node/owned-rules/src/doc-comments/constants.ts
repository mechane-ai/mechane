/**
 * Public interfaces document caller guarantees and absence semantics. Every doc stays short and says more than its
 * declaration's name.
 */
export const DocRule = { Export: 'export-doc', Absence: 'absence-doc', Short: 'short-doc' } as const;

export type DocRule = (typeof DocRule)[keyof typeof DocRule];
