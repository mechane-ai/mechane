import { RuleTool } from '@mechane/rule-shapes';
import { Effect, Option } from 'effect';
import { relative } from 'node:path';
import { WORKSPACE_FOLDER } from '../constants.ts';
import type { InputUnreadable } from '../errors.ts';
import { lintSites } from '../lint/lint-sites.ts';
import type { Finding } from '../types.ts';
import { heldFindings } from './held-findings.ts';
import { proposedRules } from './proposed-rules.ts';
import { ratchetRules } from './ratchet-rules.ts';

/** The files the lint command names, every file when it names none, and the variables linters inherit. */
type RunLintInput = { readonly paths: ReadonlyArray<string>; readonly inherited: Readonly<Record<string, string>> };

/**
 * The lint command: lints `paths`, or every file when it names none, with oxlint and ast-grep, and holds each of their
 * ratchets to its baseline in the files it linted.
 */
export const runLint = Effect.fn('runLint')(function* ({
  paths,
  inherited,
}: RunLintInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const sites = yield* lintSites({ paths, inherited });
  const ratchets = ratchetRules();
  const proposed = proposedRules();
  const named = new Set(paths.map((path) => relative(WORKSPACE_FOLDER, path)));

  const scope: Option.Option<ReadonlySet<string>> = (() => {
    if (named.size === 0) {
      return Option.none();
    }

    return Option.some(named);
  })();

  return yield* heldFindings({
    sites,
    ratchets: ratchets.filter(({ tool }) => tool !== RuleTool.Owned),
    proposed,
    scope,
  });
});
