import type { PathMove } from '@mechane/checks-kernel';

/** A member by its package name and its folder relative to the workspace, empty for the root. */
export type PlacedMember = { readonly name: string; readonly folder: string };

/** Where a step leaves the tree: the moves it makes, the root, and the folder of each other member after it. */
export type StepLayout = {
  readonly moves: ReadonlyArray<PathMove>;
  readonly root: PlacedMember;
  readonly packages: ReadonlyArray<PlacedMember>;
};

/**
 * A name a file takes from another member's entry: the member, and the file that declares it after the step. Then the
 * name it declares and the name the entry exports, and whether only types take it.
 */
export type Requirement = {
  readonly member: PlacedMember;
  readonly path: string;
  readonly name: string;
  readonly exported: string;
  readonly isTypeOnly: boolean;
};

/**
 * A TypeScript file after the step: its paths before and after it, its text, whether either changed, and what it takes
 * from other members' entries.
 */
export type RewrittenSource = {
  readonly from: string;
  readonly path: string;
  readonly text: string;
  readonly isChanged: boolean;
  readonly requirements: ReadonlyArray<Requirement>;
};
