/** The generated files that differ, the strays, and the registry's findings as lines. */
type StaleLinesInput = {
  readonly changed: ReadonlyArray<string>;
  readonly strays: ReadonlyArray<string>;
  readonly lines: ReadonlyArray<string>;
};

/** What a check reports: each generated file that differs, each stray, then the registry's findings. */
export function staleLines({ changed, strays, lines }: StaleLinesInput): ReadonlyArray<string> {
  const changedLine: (path: string) => string = (path) =>
    `${path}: Regenerate it, such as \`mise run fix\` does (AS-03)`;

  const strayLine: (path: string) => string = (path) =>
    `${path}: Delete it, such as \`mise run fix\` does, since the registry no longer generates it (AS-03)`;

  return [...changed.map(changedLine), ...strays.map(strayLine), ...lines];
}
