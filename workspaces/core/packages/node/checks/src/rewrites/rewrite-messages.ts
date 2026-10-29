import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import { entryFiles } from '@mechane/normalizers';
import { RuleTool } from '@mechane/rule-shapes';
import type { NormalizerRewrite, NormalizerRule } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Effect } from 'effect';
import { rewriteMessage } from './rewrite-message.ts';

/** The members, whose entries and source roots each normalizer's rewrites run with. */
type RewriteMessagesInput = { readonly members: ReadonlyArray<Member> };

/** A normalizer, the entries the manifests export, and every member's source roots. */
type RuleMessagesInput = {
  readonly rule: NormalizerRule;
  readonly entries: ReadonlyMap<string, string>;
  readonly roots: ReadonlyArray<string>;
};

/** What one normalizer's rewrites show: that it has none, or each one it leaves other than as the rewrite shows. */
const ruleMessages = Effect.fn('ruleMessages')(function* ({
  rule,
  entries,
  roots,
}: RuleMessagesInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  if (rule.rewrites.length === 0) {
    return [
      `Give ${rule.name} a rewrite, such as \`rewrites: [{ before: { 'scripts/a.ts': '…' }, after: { 'scripts/a.ts': '…' } }]\` (TS-05)`,
    ];
  }

  /** What one of the normalizer's rewrites shows. */
  const shownMessages: (rewrite: NormalizerRewrite) => Effect.Effect<ReadonlyArray<string>, InputUnreadable> = (
    rewrite,
  ) => rewriteMessage({ rule, rewrite, entries, roots });

  const messages = yield* Effect.forEach(rule.rewrites, shownMessages, { concurrency: 1 });

  return messages.flat();
});

/**
 * Each normalizer that lacks a rewrite, or leaves one other than as its `after` shows, in memory (TS-05). A rewrite's
 * `before` runs through the normalizer until it settles, as `mise run fix` runs it over the workspace.
 */
export const rewriteMessages = Effect.fn('rewriteMessages')(function* ({
  members,
}: RewriteMessagesInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const entries = yield* entryFiles({ members });
  const roots = members.flatMap(({ sourceRoots }) => sourceRoots);
  const normalizers = REGISTERED_RULES.map(({ rule }) => rule).filter((rule) => rule.tool === RuleTool.Normalizer);

  const messages = yield* Effect.forEach(normalizers, (rule) => ruleMessages({ rule, entries, roots }), {
    concurrency: 1,
  });

  return messages.flat();
});
