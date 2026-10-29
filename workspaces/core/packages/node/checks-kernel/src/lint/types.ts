/** The paths one linter run reads, a whole folder or each file, and the variables the linter inherits. */
export type ToolSitesInput = {
  readonly targets: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};
