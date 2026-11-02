/** Selection encoded in the console URL. */
export type ConsoleLocation = {
  /** Omitted to select the first available workspace. */
  readonly workspace?: string;
  /** Omitted to show the workspace's mech list. */
  readonly mech?: string;
  /** Omitted to show the mech overview. */
  readonly turn?: string;
};
