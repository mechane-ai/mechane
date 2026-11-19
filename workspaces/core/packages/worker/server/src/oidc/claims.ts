import type { JWTPayload } from 'jose';
import type { ManagedIdentityIssuer } from './settings.ts';

const SUBJECT_MAX_CHARS = 512;
const STABLE_CLAIMS: ReadonlySet<string> = new Set(['sub', 'oid']);

type GroupMatch = { readonly pattern: string; readonly group: string };
type RoleInput = { readonly issuer: ManagedIdentityIssuer; readonly claims: JWTPayload };

function matchesGroup({ pattern, group }: GroupMatch): boolean {
  const rule = Array.from(pattern);
  const value = Array.from(group);
  const cursor = { position: 0, step: 0, star: -1, resume: 0 };

  while (cursor.position < value.length) {
    const character = rule[cursor.step];

    if (character === '*') {
      cursor.star = cursor.step;
      cursor.resume = cursor.position;
      cursor.step += 1;
    } else if (character === '?' || character === value[cursor.position]) {
      cursor.position += 1;
      cursor.step += 1;
    } else {
      if (cursor.star === -1) {
        return false;
      }

      cursor.resume += 1;
      cursor.position = cursor.resume;
      cursor.step = cursor.star + 1;
    }
  }

  return rule.slice(cursor.step).every((character) => character === '*');
}

function claimAt(claims: JWTPayload, path: string): unknown {
  if (!path.startsWith('/')) {
    if (Object.hasOwn(claims, path)) {
      return claims[path];
    }

    return undefined;
  }

  const steps = path.slice(1).split('/');
  const cursor: { value: unknown } = { value: claims };

  for (const encoded of steps) {
    const segment = encoded.replaceAll('~1', '/').replaceAll('~0', '~');

    if (typeof cursor.value !== 'object' || cursor.value === null || !Object.hasOwn(cursor.value, segment)) {
      return undefined;
    }

    cursor.value = Reflect.get(cursor.value, segment);
  }

  return cursor.value;
}

function claimGroups(value: unknown): ReadonlyArray<unknown> {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

export function oidcIdentity({ issuer, claims }: RoleInput) {
  const subjectClaim = issuer.subject_claim ?? 'sub';
  const subject = claimAt(claims, subjectClaim);

  if (typeof subject !== 'string') {
    return null;
  }

  if (subject.length === 0 || subject.includes('\u0000') || subject.length > SUBJECT_MAX_CHARS) {
    return null;
  }

  const groups = claimAt(claims, issuer.groups_claim ?? 'groups');
  const names = claimGroups(groups);

  const matches = (issuer.roles ?? []).filter((rule) =>
    names.some((group) => typeof group === 'string' && matchesGroup({ pattern: rule.group, group })),
  );

  const role =
    ['admin', 'developer', 'user'].find((level) => matches.some((rule) => rule.role === level)) ?? issuer.default_role;

  const sharesActorSubject = STABLE_CLAIMS.has(subjectClaim) || issuer.stable_subject === true;

  return { subject, subjectClaim, role, sharesActorSubject };
}
