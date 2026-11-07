import { FileRole } from '@mechane/rule-shapes';
import type { RestrictedRule } from '@mechane/rule-shapes';
import { Array, Record } from 'effect';
import { matchesGlob } from 'node:path';
import { FILE_ROLES } from '../file-roles.ts';
import { RestrictedKey } from './constants.ts';
import { restrictedLists } from './restricted-lists.ts';
import type { RoleOverride } from './types.ts';

type RestrictedOverridesInput = { readonly restricted: ReadonlyArray<RestrictedRule> };

type RestrictedScope = {
  readonly pattern: string;
  readonly roles: ReadonlyArray<FileRole>;
  readonly excludeFiles: ReadonlyArray<string>;
};

type ScopeOverrideInput = {
  readonly scopes: Array.NonEmptyReadonlyArray<RestrictedScope>;
  readonly restricted: ReadonlyArray<RestrictedRule>;
};

/** Oxlint replaces restricted lists wholesale, so each disjoint scope needs all of its roles' exemptions together. */
export function restrictedOverrides({ restricted }: RestrictedOverridesInput): ReadonlyArray<RoleOverride> {
  const roles = Record.values(FileRole).filter((role) =>
    restricted.some(({ exemptRoles }) => exemptRoles.includes(role)),
  );

  const rolePatterns = roles.flatMap((role) => FILE_ROLES[role]);
  const patterns = Array.dedupe(rolePatterns);

  const scopes = patterns.map((pattern) => ({
    pattern,
    roles: roles.filter((role) => FILE_ROLES[role].some((scope) => scope === pattern || matchesGlob(pattern, scope))),
    excludeFiles: patterns.filter((narrower) => narrower !== pattern && matchesGlob(narrower, pattern)),
  }));

  const groups = Array.groupBy(scopes, ({ roles: inherited }) => inherited.join(','));

  return Record.values(groups).map((group) => scopeOverride({ scopes: group, restricted }));
}

function scopeOverride({ scopes: [first, ...rest], restricted }: ScopeOverrideInput): RoleOverride {
  const scopes = [first, ...rest];

  const isBanned: (rule: RestrictedRule) => boolean = ({ exemptRoles }) =>
    !exemptRoles.some((role) => first.roles.includes(role));

  const excluded = scopes.flatMap((scope) => scope.excludeFiles);
  const banned = restricted.filter(isBanned);
  const keys = Record.values(RestrictedKey);

  return {
    files: scopes.map(({ pattern }) => pattern),
    excludeFiles: Array.dedupe(excluded),
    rules: restrictedLists({ restricted: banned, keys }),
  };
}
