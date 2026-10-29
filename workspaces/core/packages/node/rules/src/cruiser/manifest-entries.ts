import { ManifestFamily, Severity } from '@mechane/rule-shapes';
import type { ManifestRule } from '@mechane/rule-shapes';
import type { WorkspaceMember } from '../types.ts';
import { confineRules } from './confine-rules.ts';
import { familyRuleName } from './family-rule-name.ts';
import { laneRules } from './lane-rules.ts';
import { memberLayer } from './member-layer.ts';
import type { CruiserEntry, FamilyRule } from './types.ts';

/** A family of the registry, and every member that holds a package. */
type FamilyInput = { readonly rule: ManifestRule; readonly members: ReadonlyArray<WorkspaceMember> };

/**
 * The dependency-cruiser rules a family of the registry writes from the manifest, each named for the family and its
 * subject, such as `layer:@mechane/client`, with the family's comment.
 */
export function manifestEntries({ rule, members }: FamilyInput): ReadonlyArray<CruiserEntry> {
  const familyEntry: (familyRule: FamilyRule) => CruiserEntry = ({ subject, from, to }) => ({
    name: familyRuleName({ family: rule.name, subject }),
    comment: rule.comment,
    severity: Severity.Error,
    from,
    to,
  });

  return familyRules({ rule, members }).map(familyEntry);
}

/** The family's rules, over the members whose package holds a source root. */
function familyRules({ rule, members }: FamilyInput): ReadonlyArray<FamilyRule> {
  const rooted = members.filter(({ roots }) => roots.length > 0);

  switch (rule.name) {
    case ManifestFamily.Layer:
      return rooted.map((member) => memberLayer({ member, members: rooted }));
    case ManifestFamily.Lane:
      return laneRules({ members: rooted });
    case ManifestFamily.Confine:
      return confineRules({ members: rooted });
  }
}
