import { Severity } from '@mechane/rule-shapes';
import type { FileRole, OxlintRule } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { FILE_ROLES } from '../file-roles.ts';
import type { RoleOverride } from './types.ts';

type RoleOverrideInput = { readonly role: FileRole; readonly configured: ReadonlyArray<OxlintRule> };

/** Ordinary rule exemptions compose because every matching role only turns its own rules off. */
export function roleOverride({ role, configured }: RoleOverrideInput): ReadonlyArray<RoleOverride> {
  const isExempt: (rule: OxlintRule) => boolean = ({ exemptRoles }) => exemptRoles.some((exempt) => exempt === role);

  const off = configured.filter(isExempt);
  const entries = off.map(({ name }) => [name, Severity.Off] as const);
  const rules = Record.fromEntries(entries);

  if (Record.isEmptyRecord(rules)) {
    return [];
  }

  return [{ files: FILE_ROLES[role], excludeFiles: [], rules }];
}
