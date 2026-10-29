import { folderPrefixPath, movedPath } from '@mechane/checks-kernel';
import type { Member } from '@mechane/checks-kernel';
import { memberOf } from '../member-of.ts';
import type { PlacedMember, StepLayout } from '../packages.types.ts';
import type { ReadManifest } from './types.ts';

/**
 * The layout, every file git tracks before the step, a member after it, the member as it stood before, and each
 * member's manifest before the step.
 */
type IsLostInput = {
  readonly layout: StepLayout;
  readonly files: ReadonlyArray<string>;
  readonly member: PlacedMember;
  readonly before: Member;
  readonly manifests: ReadonlyMap<string, ReadManifest>;
};

/** A member as it stood before the step, a path relative to the workspace, and each member's manifest then. */
type HeldBeforeInput = {
  readonly before: Member;
  readonly path: string;
  readonly manifests: ReadonlyMap<string, ReadManifest>;
};

/** Whether a member lost a file to another member, so a dependency only that file imported goes. */
export function isLost({ layout, files, member, before, manifests }: IsLostInput): boolean {
  /** Whether the member held the file before the step, and another member holds it after. */
  const isLostFile: (path: string) => boolean = (path) =>
    isHeldBefore({ before, path, manifests }) &&
    memberOf({ layout, path: movedPath({ moves: layout.moves, path }) }) !== member;

  return files.some(isLostFile);
}

/** Whether a member held a path before the step: the root holds each path no other member's folder holds. */
function isHeldBefore({ before, path, manifests }: HeldBeforeInput): boolean {
  if (before.folder !== '') {
    return path.startsWith(folderPrefixPath({ folder: before.folder }));
  }

  /** Whether another member's folder held the path. */
  const isOthers: (read: ReadManifest) => boolean = ({ member }) =>
    member.folder !== '' && path.startsWith(folderPrefixPath({ folder: member.folder }));

  return ![...manifests.values()].some(isOthers);
}
