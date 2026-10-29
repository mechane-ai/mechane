import { Severity } from '@mechane/rule-shapes';
import type { FileRole, OxlintRule, RestrictedRule } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { FILE_ROLES } from '../file-roles.ts';
import { RestrictedKey } from './constants.ts';
import { restrictedLists } from './restricted-lists.ts';
import type { RoleOverride } from './types.ts';

type RoleOverrideInput = {
  readonly role: FileRole;
  readonly configured: ReadonlyArray<OxlintRule>;
  readonly restricted: ReadonlyArray<RestrictedRule>;
};

type IsBanningInput = { readonly rule: RestrictedRule; readonly key: RestrictedKey };

/**
 * The override of one file role, when a rule treats its files apart: each rule off there, and each restricted list that
 * drops the members allowed there.
 */
export function roleOverride({ role, configured, restricted }: RoleOverrideInput): ReadonlyArray<RoleOverride> {
  const isExempt: (rule: OxlintRule | RestrictedRule) => boolean = ({ exemptRoles }) =>
    exemptRoles.some((exempt) => exempt === role);

  const off = configured.filter(isExempt);
  const allowed = restricted.filter(isExempt);
  const isListed: (key: RestrictedKey) => boolean = (key) => allowed.some((rule) => isBanning({ rule, key }));
  const keys = Record.values(RestrictedKey).filter(isListed);
  const isBanned: (rule: RestrictedRule) => boolean = (rule) => !allowed.includes(rule);

  const rules = {
    ...Record.fromEntries(off.map(({ name }) => [name, Severity.Off])),
    ...restrictedLists({ restricted: restricted.filter(isBanned), keys }),
  };

  if (Record.isEmptyRecord(rules)) {
    return [];
  }

  return [{ files: FILE_ROLES[role], rules }];
}

/** Whether a restricted rule bans anything the restricted list of `key` holds. */
function isBanning({ rule, key }: IsBanningInput): boolean {
  switch (key) {
    case RestrictedKey.Imports:
      return rule.imports.length > 0;
    case RestrictedKey.Properties:
      return !Record.isEmptyRecord(rule.properties);
  }
}
