import type { ChecksFailure, Finding } from '@mechane/checks-kernel';
import { normalize } from '@mechane/normalizers';
import { Normalizer, RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Effect, Record } from 'effect';

/** The absolute paths whose files the enforced normalizers rewrite, every file when they are none. */
type ApplyNormalizersInput = { readonly paths: ReadonlyArray<string> };

/**
 * The normalize command: each normalizer whose rule the registry enforces rewrites the files under `paths`, or every
 * file, in the order of `Normalizer`. It leaves the code its behavior leaves to the live release verification. Until
 * its rule is enforced, only a sweep that names a normalizer runs it.
 */
export const applyNormalizers = Effect.fn('applyNormalizers')(function* ({
  paths,
}: ApplyNormalizersInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const enforced: ReadonlySet<Normalizer> = new Set(
    REGISTERED_RULES.map(({ rule }) => rule)
      .filter((rule) => rule.tool === RuleTool.Normalizer)
      .filter(({ status }) => status === RuleStatus.Enforced)
      .map(({ name }) => name),
  );

  const normalizers = Record.values(Normalizer).filter((normalizer) => enforced.has(normalizer));

  yield* Effect.forEach(normalizers, (normalizer) => normalize({ normalizer, paths }), {
    concurrency: 1,
    discard: true,
  });

  return [];
});
