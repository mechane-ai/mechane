import { FileRole, RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { Array, Record } from 'effect';
import { matchesGlob } from 'node:path';
import { CONTRACTS } from '../contracts.ts';
import { FILE_ROLES } from '../file-roles.ts';
import { REGISTERED_RULES } from '../registered-rules.ts';
import { RestrictedKey } from './constants.ts';
import { oxlintSettings } from './oxlint-settings.ts';
import { restrictedLists } from './restricted-lists.ts';

type RestrictedOverrideFailuresInput = { readonly files: ReadonlyArray<string> };

/** Compare the compact glob partition with actual role membership; crossing scopes must not silently widen access. */
export function restrictedOverrideFailures({ files }: RestrictedOverrideFailuresInput): ReadonlyArray<string> {
  const rules = REGISTERED_RULES.map(({ rule }) => rule).filter((rule) => rule.status !== RuleStatus.Proposed);
  const restricted = rules.filter((rule) => rule.tool === RuleTool.Restricted);
  const keys = Record.values(RestrictedKey);
  const { optOuts } = CONTRACTS['code-lint-suppressions'].values.oxlint;
  const settings = oxlintSettings({ rules, optOuts });
  const overrides = settings.overrides.filter((override) => keys.some((key) => Object.hasOwn(override.rules, key)));

  const isMisconfigured: (file: string) => boolean = (file) => {
    const matchedRoles = Record.values(FileRole).filter((role) =>
      FILE_ROLES[role].some((scope) => matchesGlob(file, scope)),
    );

    const roles = new Set(matchedRoles);

    const banned = restricted.filter(({ exemptRoles }) => !exemptRoles.some((role) => roles.has(role)));
    const expected = restrictedLists({ restricted: banned, keys });

    const matching = overrides.filter(
      (override) =>
        override.files.some((scope) => matchesGlob(file, scope)) &&
        !override.excludeFiles.some((scope) => matchesGlob(file, scope)),
    );

    const actual = Array.reduce(matching, settings.rules, (current, override) => ({ ...current, ...override.rules }));

    return matching.length > 1 || keys.some((key) => JSON.stringify(actual[key]) !== JSON.stringify(expected[key]));
  };

  return files.filter(isMisconfigured);
}
