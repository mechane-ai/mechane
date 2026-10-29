/**
 * The doc comment rules, by the names their sites count under. Every export has a doc, and every field that may be
 * absent says what absence means. Every doc stays short and says more than its name.
 */
export const DocRule = { Export: 'export-doc', Absence: 'absence-doc', Short: 'short-doc' } as const;

export type DocRule = (typeof DocRule)[keyof typeof DocRule];
