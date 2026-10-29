import type { Member, TextFile } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import type { BannedPhrase } from '@mechane/owned-rules';

/**
 * An example's tree as an owned rule's run reads it, as the checks read the workspace. It holds the example's files,
 * each TypeScript file parsed, the members for their source roots, the entries their manifests export, and the
 * glossary's banned phrases.
 */
export type ExampleIndex = {
  readonly members: ReadonlyArray<Member>;
  readonly entries: ReadonlyMap<string, string>;
  readonly files: ReadonlyArray<TextFile>;
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly phrases: ReadonlyArray<BannedPhrase>;
};

/** What each example's index shares with the workspace: its members, their entries and the banned phrases. */
export type ExampleWorkspace = Pick<ExampleIndex, 'members' | 'entries' | 'phrases'>;

/** One finding a run reports: the rule it counts under, and its message before the rule's standard ends it. */
export type RunFinding = { readonly rule: string; readonly message: string };

/** How an owned rule decides on an example's tree, as its check decides on the workspace's files. */
export type ExampleRun = (index: ExampleIndex) => ReadonlyArray<RunFinding>;
