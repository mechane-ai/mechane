/** A violation example of an ast-grep rule, the file it is written to, and what the rule's fix should leave of it. */
export type FixExample = { readonly path: string; readonly violation: string; readonly fixed: string };

/** An example of an oxlint rule, the file it is written to, and whether the rule flags it. */
export type OxlintExample = { readonly path: string; readonly text: string; readonly isViolation: boolean };
