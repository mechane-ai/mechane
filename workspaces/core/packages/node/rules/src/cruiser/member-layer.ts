import type { Lane } from '@mechane/rule-shapes';
import { Option } from 'effect';
import { CONTRACTS } from '../contracts.ts';
import type { WorkspaceMember } from '../types.ts';
import { entriesPattern } from './entries-pattern.ts';
import { rootsPattern } from './roots-pattern.ts';
import type { FamilyRule } from './types.ts';

/** A member, and every member that holds a source root. */
type MemberLayerInput = { readonly member: WorkspaceMember; readonly members: ReadonlyArray<WorkspaceMember> };

/** A member that imports, and the member it would import. */
type IsAllowedInput = { readonly from: WorkspaceMember; readonly to: WorkspaceMember };

/**
 * A member's layer rule: from its source roots, every file of another member is forbidden. Only the entry point of each
 * member in a lower layer that its lane imports and whose consumers name it stays allowed.
 */
export function memberLayer({ member, members }: MemberLayerInput): FamilyRule {
  const others = members.filter(({ name }) => name !== member.name);
  const allowed = others.filter((to) => isAllowed({ from: member, to }));
  const layer = { subject: member.name, from: { path: rootsPattern({ members: [member] }) } };
  const forbidden = { path: rootsPattern({ members: others }) };

  if (allowed.length === 0) {
    return { ...layer, to: forbidden };
  }

  return { ...layer, to: { ...forbidden, pathNot: entriesPattern({ members: allowed }) } };
}

/** Whether `from` may import `to`: from a strictly lower layer, in a lane its own imports, and among its consumers. */
function isAllowed({ from, to }: IsAllowedInput): boolean {
  const lanes: ReadonlyArray<Lane> = CONTRACTS['package-layers'].values.laneImports[from.entry.lane];

  return (
    to.entry.layer < from.entry.layer &&
    lanes.includes(to.entry.lane) &&
    Option.match(to.entry.consumers, { onNone: () => true, onSome: (names) => names.includes(from.name) })
  );
}
