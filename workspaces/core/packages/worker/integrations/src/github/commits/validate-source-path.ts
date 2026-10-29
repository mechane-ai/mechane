import type { SourceGrant } from '@mechane/protocol';
import { SourceFileMode, sourcePathAllowed } from '@mechane/records';
import { Option, Result } from 'effect';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';
import { GitHubObjectType } from './constants.ts';
import type { GitHubTreeEntry } from './schemas.ts';

const SOURCE_FILE_MODES: ReadonlySet<string> = new Set([SourceFileMode.File, SourceFileMode.Executable]);

type ValidateSourcePathInput = {
  readonly grant: SourceGrant;
  readonly path: string;
  readonly known: ReadonlyMap<string, GitHubTreeEntry>;
};

type SourceAncestorsInput = Pick<ValidateSourcePathInput, 'path' | 'known'>;

/** Protects grants, workflow configuration, non-file objects and every ancestor of a changed file. */
export function validateSourcePath({
  grant,
  path,
  known,
}: ValidateSourcePathInput): Result.Result<Option.Option<GitHubTreeEntry>, GitHubFailed> {
  const isAllowed = sourcePathAllowed({ path, prefixes: grant.writePaths });
  const foldedPath = path.toLowerCase();

  if (!isAllowed || foldedPath.startsWith('.github/workflows/')) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'source patch includes an ungranted or protected path',
    });
  }

  const hasProtectedAncestor = hasProtectedSourceAncestor({ path, known });

  if (hasProtectedAncestor) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'source patch replaces an ungranted ancestor' });
  }

  const entry = known.get(path);
  const original = Option.fromUndefinedOr(entry);

  const isFileMode: (candidate: GitHubTreeEntry) => boolean = (candidate) => SOURCE_FILE_MODES.has(candidate.mode);

  const hasFileMode = Option.exists(original, isFileMode);

  if (Option.isSome(original) && !hasFileMode) {
    return failGitHub({
      status: GITHUB_UNKNOWN_STATUS,
      reason: 'source patch replaces a tree, symbolic link, or submodule',
    });
  }

  return Result.succeed(original);
}

function hasProtectedSourceAncestor({ path, known }: SourceAncestorsInput): boolean {
  const parts = path.split('/');
  const ancestors = parts.slice(0, -1);

  const isProtected: (part: string, index: number) => boolean = (_part, index) => {
    const segments = parts.slice(0, index + 1);
    const ancestorPath = segments.join('/');
    const entry = known.get(ancestorPath);
    const ancestor = Option.fromUndefinedOr(entry);

    return Option.isSome(ancestor) && ancestor.value.type !== GitHubObjectType.Tree;
  };

  return ancestors.some(isProtected);
}
