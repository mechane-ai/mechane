import { RolloutPhase, RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { Rule } from '@mechane/rule-shapes';
import { Option } from 'effect';
import { loadedAsset } from '../assets/loaded-asset.ts';
import type { LoadedAsset } from '../types.ts';
import { bannedMembers } from './banned-members.ts';

type RuleInput = { readonly rule: Rule };

/**
 * One rule: its tool and name, or the installed file it loads, the rule of the standard it serves, where it stands, and
 * what it holds.
 */
export function ruleText({ rule }: RuleInput): string {
  const stands = `(${rule.standard}): ${standing({ rule })}`;
  const assetSource: (loaded: LoadedAsset) => string = ({ asset }) => `asset \`${asset.path}\``;
  const loaded = loadedAsset({ rule });
  const source = Option.match(loaded, { onNone: () => rule.tool, onSome: assetSource });

  switch (rule.tool) {
    case RuleTool.Oxlint:
      return `${source} \`${rule.name}\` ${stands}, \`${JSON.stringify(rule.value)}\``;
    case RuleTool.Restricted:
      return `oxlint's restricted members ${stands}: ${bannedMembers({ rule })}`;
    case RuleTool.Owned:
      return `owned check \`${rule.name}\` ${stands}`;
    case RuleTool.AstGrep:
      return `${source} \`${rule.name}\` ${stands}`;
    case RuleTool.Compiler:
      return `compiler option \`${rule.name}\` ${stands}, \`${String(rule.value)}\``;
    case RuleTool.Cruiser:
      return `dependency-cruiser \`${rule.name}\` ${stands}: ${rule.comment}`;
    case RuleTool.Manifest:
      return `dependency-cruiser family \`${rule.name}\` ${stands}: ${rule.comment}`;
    case RuleTool.Normalizer:
      return `normalizer \`${rule.name}\` ${stands}`;
  }
}

/** Where a rule stands: enforced, adopted before the rollout or in a phase, a ratchet, or proposed for a phase. */
function standing({ rule }: RuleInput): string {
  if (rule.phase === RolloutPhase.Adopted) {
    return rule.status;
  }

  switch (rule.status) {
    case RuleStatus.Enforced:
      return `enforced in phase ${rule.phase}`;
    case RuleStatus.Ratchet:
      return `a ratchet until phase ${rule.phase}`;
    case RuleStatus.Proposed:
      return `proposed for phase ${rule.phase}`;
  }
}
