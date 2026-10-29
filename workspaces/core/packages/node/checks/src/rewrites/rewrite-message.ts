import type { FileChange, InputUnreadable, Site } from '@mechane/checks-kernel';
import { parsedText } from '@mechane/checks-kernel';
import { ruleSites, settledChanges } from '@mechane/normalizers';
import { MESSAGE_FORM } from '@mechane/rule-shapes';
import type { NormalizerRewrite, NormalizerRule, OwnedExample } from '@mechane/rule-shapes';
import { gatedGlobs } from '@mechane/rules';
import { Effect, Equivalence, Option, Record } from 'effect';

/** A normalizer, one of its rewrites, the entries the manifests export, and every member's source roots. */
type RewriteMessageInput = {
  readonly rule: NormalizerRule;
  readonly rewrite: NormalizerRewrite;
  readonly entries: ReadonlyMap<string, string>;
  readonly roots: ReadonlyArray<string>;
};

/** A normalizer, one of its rewrites, and what the normalizer changes in the rewrite's `before` once it settles. */
type LeftMessagesInput = {
  readonly rule: NormalizerRule;
  readonly rewrite: NormalizerRewrite;
  readonly changes: ReadonlyArray<FileChange>;
};

/** Whether two trees hold the same files with the same texts. */
const isSameTree = Record.makeEquivalence(Equivalence.String);

/**
 * Each finding the normalizer's check reports on a rewrite's `before` that does not read as AS-01 says, and the tree
 * the normalizer leaves where it is not the rewrite's `after`.
 */
export const rewriteMessage = Effect.fn('rewriteMessage')(function* ({
  rule,
  rewrite,
  entries,
  roots,
}: RewriteMessageInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const sources = Record.toEntries(rewrite.before).map(([path, text]) => parsedText({ path, text }));

  const changes = yield* settledChanges({
    normalizer: rule.name,
    sources,
    entries,
    roots,
    scope: { paths: [], excluded: gatedGlobs({ rule: rule.name }) },
  });

  const sites = yield* ruleSites({ rule, entries, roots, sources });

  /** Whether a finding does not read as AS-01 says. */
  const isMisread: (site: Site) => boolean = ({ message }) => !MESSAGE_FORM.test(message);

  /** The message of a finding that does not read as AS-01 says. */
  const rewordMessage: (site: Site) => string = ({ message }) =>
    `Reword the finding of ${rule.name}, such as \`Name it, such as 'isReady' (NM-07)\`, since it reads: ${message} (AS-01)`;

  return [...sites.filter(isMisread).map(rewordMessage), ...leftMessages({ rule, rewrite, changes })];
});

/**
 * The tree a rewrite's normalizer leaves, where it is not the rewrite's `after`: each changed file's last text, and no
 * file the normalizer deletes.
 */
function leftMessages({ rule, rewrite, changes }: LeftMessagesInput): ReadonlyArray<string> {
  const changed: ReadonlySet<string> = new Set(changes.map(({ path }) => path));

  /** A change's last text under its path, or nothing when the normalizer deletes the file. */
  const writtenEntry: (change: FileChange) => ReadonlyArray<readonly [string, string]> = ({ path, text }) =>
    Option.toArray(text).map((last) => [path, last] as const);

  /** Whether the normalizer left the file of `path` as it was. */
  const isUnchanged: (text: string, path: string) => boolean = (_, path) => !changed.has(path);

  const left: OwnedExample = {
    ...Record.filter(rewrite.before, isUnchanged),
    ...Record.fromEntries(changes.flatMap(writtenEntry)),
  };

  if (isSameTree(left, rewrite.after)) {
    return [];
  }

  const paths = Record.keys(rewrite.before).join(', ');

  return [
    `Fix ${rule.name} or its rewrite of \`${paths}\`, such as \`after: ${JSON.stringify(left)}\`, which it leaves (TS-05)`,
  ];
}
