/** The workspace file that declares a binding, its text, and the start of each line that declares it. */
export type DeclaringFile = { readonly path: string; readonly text: string; readonly ats: ReadonlyArray<string> };

/** Where a type is declared: its file's absolute path and the start of its declaring line. */
export type TypeSite = { readonly path: string; readonly at: string };
