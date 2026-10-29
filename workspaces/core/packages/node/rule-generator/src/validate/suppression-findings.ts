import { Effect, Option } from 'effect';
import { REGISTRY } from '../constants.ts';
import type { GenerateFailed } from '../errors.ts';
import { readInput } from '../files/read-input.ts';
import type { RegistryFinding } from '../types.ts';
import { suppressionBudget } from './suppression-budget.ts';

/** The extension of a TypeScript file, whose suppressions the budgets count. */
const TYPESCRIPT_EXTENSION = '.ts';

/**
 * Every suppression form, each capturing the rules it names: oxlint's and ast-grep's next-line directives, an owned
 * check's `<check>-allow <rule>`, and the start of a block jscpd skips.
 */
const SUPPRESSION_FORMS: ReadonlyArray<RegExp> = [
  /^\s*\/\/ oxlint-disable-next-line ([\w/-]+(?:, [\w/-]+)*) -- /,
  /^\s*\/\/ ast-grep-ignore: ([\w-]+(?:, [\w-]+)*)$/,
  /^\s*\/\/ [a-z-]+-allow ([a-z-]+) -- /,
  /^\s*\/\/ (jscpd):ignore-start -- /,
];

/** Every file of the workspace, relative to it. */
type SuppressionFindingsInput = { readonly files: ReadonlyArray<string> };

/** One line of a TypeScript file. */
type SuppressedNamesInput = { readonly line: string };

/** A rule, and the sites that suppress it. */
type SuppressedRule = readonly [string, ReadonlyArray<string>];

/**
 * Each rule suppressed more often than its budget allows (AS-02), counting every rule each suppression of a TypeScript
 * file names: oxlint's, ast-grep's, an owned check's and jscpd's. A rule's budget is its entry's, and 0 without one.
 */
export const suppressionFindings = Effect.fn('suppressionFindings')(function* ({
  files,
}: SuppressionFindingsInput): Effect.fn.Return<ReadonlyArray<RegistryFinding>, GenerateFailed> {
  const texts = yield* Effect.forEach(
    files.filter((file) => file.endsWith(TYPESCRIPT_EXTENSION)),
    (path) => readInput({ path }),
    { concurrency: 8 },
  );

  const named = texts.flatMap((text) => text.split('\n')).flatMap((line) => suppressedNames({ line }));
  const counts = Map.groupBy(named, (name) => name);
  const isOverBudget: (rule: SuppressedRule) => boolean = ([name, sites]) => sites.length > suppressionBudget({ name });

  const budgetFinding: (rule: SuppressedRule) => RegistryFinding = ([name, sites]) => ({
    path: REGISTRY,
    message: `Fix a site of ${name} or reword the rule, such as removing \`${name}\` from a suppression, since it is suppressed ${String(sites.length)} times where its budget allows ${String(suppressionBudget({ name }))} (AS-02)`,
  });

  return [...counts].filter(isOverBudget).map(budgetFinding);
});

/** The rules a line's suppression names, in any of the suppression forms. */
function suppressedNames({ line }: SuppressedNamesInput): ReadonlyArray<string> {
  const capturedNames: (form: RegExp) => ReadonlyArray<string> = (form) => {
    const match = Option.fromNullishOr(form.exec(line));

    return Option.toArray(Option.flatMap(match, (found) => Option.fromNullishOr(found[1])));
  };

  return SUPPRESSION_FORMS.flatMap(capturedNames).flatMap((names) => names.split(', '));
}
