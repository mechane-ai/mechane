import { Option } from 'effect';
import { posix } from 'node:path';
import type { WorkspaceMember } from '../types.ts';
import { escapedPath } from './escaped-path.ts';
import { rootsPattern } from './roots-pattern.ts';
import type { FamilyRule } from './types.ts';

/** The folder every installed package lies in, which a confined package's pattern starts with. */
const INSTALLED_PACKAGES = '/node_modules';

/** Every member that holds a source root. */
type ConfineRulesInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/** A confined package, and every member that holds a source root. */
type ConfineRuleInput = { readonly name: string; readonly members: ReadonlyArray<WorkspaceMember> };

/** Each confined package's rule, for every package the `confines` of a member names. */
export function confineRules({ members }: ConfineRulesInput): ReadonlyArray<FamilyRule> {
  const confinedBy: (member: WorkspaceMember) => ReadonlyArray<string> = ({ entry }) =>
    Option.getOrElse(entry.confines, () => []);

  const confined = new Set(members.flatMap(confinedBy));

  return [...confined].toSorted().map((name) => confineRule({ name, members }));
}

/** A confined package's rule: only the source roots of the members whose `confines` names it import it. */
function confineRule({ name, members }: ConfineRuleInput): FamilyRule {
  const isOwner: (member: WorkspaceMember) => boolean = ({ entry }) =>
    Option.exists(entry.confines, (names) => names.includes(name));

  const owners = members.filter(isOwner);

  return {
    subject: name,
    from: { pathNot: rootsPattern({ members: owners }) },
    to: { path: posix.join(INSTALLED_PACKAGES, escapedPath({ path: name }), '/') },
  };
}
