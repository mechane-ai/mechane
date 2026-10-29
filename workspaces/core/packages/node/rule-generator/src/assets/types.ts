/** An oxlint file an installed contract ships: its path relative to the workspace, and the value it gives each rule. */
export type InstalledOxlintFile = { readonly path: string; readonly rules: Readonly<Record<string, unknown>> };
