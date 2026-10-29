import { astGrepSites, parsedSources, WORKSPACE_FOLDER, workspaceMembers } from '@mechane/checks-kernel';
import type { ChecksFailure, Finding, InheritedInput } from '@mechane/checks-kernel';
import { normalizerSites } from '@mechane/normalizers';
import { ownedSites } from '@mechane/owned-rules';
import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { CONTRACTS, oxlintSettings, REGISTERED_RULES } from '@mechane/rules';
import type { OptOuts } from '@mechane/rules';
import { Effect, Record } from 'effect';
import { NO_OPT_OUTS } from '../constants.ts';
import { writeLines } from '../write-lines.ts';
import { compileErrors } from './compile-errors.ts';
import { measureFindings } from './measure-findings.ts';
import { measureTree } from './measure-tree.ts';
import { measuredRules } from './measured-rules.ts';
import { measurementLines } from './measurement-lines.ts';
import type { Measurement } from './types.ts';

type MeasurementInput = { readonly measurement: Measurement };

/**
 * Measures every rule on the tree: an oxlint run that turns no rule off, a compile with the proposed options, an
 * ast-grep scan, and the owned rules' and normalizers' sites. It prints each rule's findings and the pending list. It
 * reports each place where the registry differs from the run.
 */
export const measureRules = Effect.fn('measureRules')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const rules = measuredRules();
  const text = JSON.stringify(oxlintSettings({ rules: rules.map(({ rule }) => rule), optOuts: NO_OPT_OUTS }));
  const lint = yield* measureTree({ text, inherited });
  const members = yield* workspaceMembers();
  const scanned = yield* astGrepSites({ targets: [WORKSPACE_FOLDER], inherited });
  const sources = yield* parsedSources({ members });
  const owned = yield* ownedSites({ sources });

  const normalized = yield* normalizerSites({
    rules: REGISTERED_RULES.map(({ rule }) => rule).filter((rule) => rule.tool === RuleTool.Normalizer),
    members,
    sources,
  });

  const sites = Map.groupBy([...scanned, ...owned, ...normalized], ({ rule }) => rule);
  const totals = new Map([...sites].map(([rule, held]) => [rule, held.length]));

  const measurement = {
    counts: new Map([...lint.counts, ...totals]),
    categorized: lint.categorized,
    fixable: lint.fixable,
    compilerErrors: yield* compileErrors({ members, rules, inherited }),
  };

  const pending = pendingOptOuts({ measurement });

  writeLines({ lines: measurementLines({ rules, measurement, pending }) });

  return measureFindings({ rules, measurement, pending });
});

/**
 * The rules off while the tree has findings: every rule of the categories with findings that the registry neither runs
 * nor turns off by decision. A proposed rule runs only in the measurement, so it stays off while it has findings.
 */
function pendingOptOuts({ measurement }: MeasurementInput): ReadonlyArray<string> {
  const { decided }: OptOuts = CONTRACTS['code-lint-suppressions'].values.oxlint.optOuts;

  const running: ReadonlySet<string> = new Set(
    REGISTERED_RULES.map(({ rule }) => rule)
      .filter((rule) => rule.tool === RuleTool.Oxlint)
      .filter(({ status }) => status !== RuleStatus.Proposed)
      .map(({ name }) => name),
  );

  /** Whether a rule of the categories has findings that the registry neither runs nor turns off by decision. */
  const isPending: (rule: string) => boolean = (rule) =>
    measurement.counts.has(rule) && !running.has(rule) && !Record.has(decided, rule);

  return [...measurement.categorized].filter(isPending).toSorted();
}
