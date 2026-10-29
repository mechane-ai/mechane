import { CRUISER_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/** The rollout of a role-order rule, which every folder's role files hold (ST-34). */
const ROLE_ORDER = {
  ...CRUISER_DEFAULTS,
  standard: 'ST-34',
  status: RuleStatus.Enforced,
  phase: RolloutPhase.Fixers,
} as const;

/** The roles a role file holds, in the order each may import the ones before it, as `<role>.ts` or a concept's. */
const ROLES = ['constants', 'schemas', 'errors', 'types'] as const;

/** The registry's generated contract names, a constant the generator writes, which is no behavior. */
const GENERATED_NAMES = '^packages/node/rule-shapes/src/contract-names[.]ts$';

type RolePathInput = { readonly folder: string; readonly roles: ReadonlyArray<string> };

type LaterRolesInput = { readonly role: (typeof ROLES)[number] };

/**
 * The rules that keep a folder's role files below its behavior files. A role file imports only its own role and earlier
 * ones, never a behavior file of its folder, so a type that a constant or schema needs sits beside it.
 */
export const ROLE_ORDER_RULES = [
  {
    ...ROLE_ORDER,
    name: 'role-order-constants',
    comment:
      'Move what the constants file needs from a later role file beside it, such as `type Phase` in `constants.ts`',
    from: { path: rolePath({ folder: '(.+/)', roles: ['constants'] }) },
    to: { path: rolePath({ folder: '$1', roles: laterRoles({ role: 'constants' }) }) },
  },
  {
    ...ROLE_ORDER,
    name: 'role-order-schemas',
    comment:
      'Move what the schemas file needs from an errors or types file beside it, such as `type Kind` in `schemas.ts`',
    from: { path: rolePath({ folder: '(.+/)', roles: ['schemas'] }) },
    to: { path: rolePath({ folder: '$1', roles: laterRoles({ role: 'schemas' }) }) },
  },
  {
    ...ROLE_ORDER,
    name: 'role-order-errors',
    comment: 'Move what the errors file needs from a types file beside it, such as `type Step` in `errors.ts`',
    from: { path: rolePath({ folder: '(.+/)', roles: ['errors'] }) },
    to: { path: rolePath({ folder: '$1', roles: laterRoles({ role: 'errors' }) }) },
  },
  {
    ...ROLE_ORDER,
    name: 'role-order-behavior',
    comment: 'Move what the role file needs from a behavior file of its folder into a role file, such as `types.ts`',
    from: { path: rolePath({ folder: '(.+/)', roles: ROLES }) },
    to: { path: '^$1[^/]+[.]ts$', pathNot: `${rolePath({ folder: '$1', roles: ROLES })}|${GENERATED_NAMES}` },
  },
] as const;

/**
 * The paths of a folder's role files of the given roles, `<role>.ts` or a concept's `<concept>.<role>.ts`, whose folder
 * a pattern or the importer's captured folder names.
 */
function rolePath({ folder, roles }: RolePathInput): string {
  return `^${folder}(?:|[^/]+[.])(?:${roles.join('|')})[.]ts$`;
}

/** The roles after a role in the import order, which a role file of that role may not import. */
function laterRoles({ role }: LaterRolesInput): ReadonlyArray<string> {
  return ROLES.slice(ROLES.indexOf(role) + 1);
}
