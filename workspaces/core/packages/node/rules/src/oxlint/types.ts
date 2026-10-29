/** The opt-out list of oxlint's categories: the rules off while they have findings, and those off by decision. */
export type OptOuts = {
  readonly pending: ReadonlyArray<string>;
  /** The reason each rule stays off, by its name. */
  readonly decided: Readonly<Record<string, string>>;
};

/**
 * oxlint's settings, as `.oxlintrc.json` holds them: the plugins, the categories that run whole, the type-aware options
 * and the ignored files. Each rule's value follows, with one override for each file role a rule treats apart.
 */
export type OxlintSettings = {
  readonly plugins: ReadonlyArray<string>;
  readonly categories: Readonly<Record<string, string>>;
  readonly options: Readonly<Record<string, unknown>>;
  readonly ignorePatterns: ReadonlyArray<string>;
  readonly rules: Readonly<Record<string, unknown>>;
  readonly overrides: ReadonlyArray<RoleOverride>;
};

/** An override of oxlint's settings: the files of one role, and the rules they run apart. */
export type RoleOverride = { readonly files: ReadonlyArray<string>; readonly rules: Readonly<Record<string, unknown>> };

/** An entry of `no-restricted-properties`: a banned property of an object, and the message. */
export type RestrictedProperty = { readonly object: string; readonly property: string; readonly message: string };
