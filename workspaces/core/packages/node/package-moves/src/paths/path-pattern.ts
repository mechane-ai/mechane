import { TRAILING_SLASH } from '@mechane/checks-kernel';
import type { PathMove } from '@mechane/checks-kernel';
import { WORKSPACE_PREFIX } from './constants.ts';

/**
 * What may stand before a path the pass rewrites: a line's start, or the slash there that anchors a CODEOWNERS path, a
 * space, a quote, a bracket, or an operator.
 */
const PATH_LEAD = String.raw`(?<=^|^/|[\s'"\x60(\[|!=,^]|\}\}/)`;

/** What may not follow a rewritten path, which would make it part of a longer name. */
const PATH_END = String.raw`(?![\w-]|\.\w)`;

type PathPatternInput = { readonly moves: ReadonlyArray<PathMove> };

/**
 * One pattern of every moved path, the longest first so a folder inside a moved folder wins, after a lead and with the
 * workspace's folder before it or not. A map's path holds only letters, digits, `_`, `-`, `.` and `/`.
 */
export function pathPattern({ moves }: PathPatternInput): RegExp {
  const paths = moves
    .map(({ from }) => from.replace(TRAILING_SLASH, ''))
    .toSorted((first, second) => second.length - first.length);

  const alternatives = paths.map((path) => path.replaceAll('.', '[.]')).join('|');

  return new RegExp(`${PATH_LEAD}(${WORKSPACE_PREFIX}|)(${alternatives})${PATH_END}`, 'gm');
}
