import { RuleTool } from '@mechane/rule-shapes';
import type { Rule } from '@mechane/rule-shapes';
import { Option } from 'effect';
import type { LoadedAsset } from '../types.ts';

type LoadedAssetInput = { readonly rule: Rule };

/** The installed file a rule loads in place, with the rule: an oxlint or ast-grep rule's asset, which no other has. */
export function loadedAsset({ rule }: LoadedAssetInput): Option.Option<LoadedAsset> {
  switch (rule.tool) {
    case RuleTool.Oxlint:
    case RuleTool.AstGrep:
      return Option.map(rule.asset, (asset) => ({ rule, asset }));
    case RuleTool.Restricted:
    case RuleTool.Compiler:
    case RuleTool.Cruiser:
    case RuleTool.Manifest:
    case RuleTool.Owned:
    case RuleTool.Normalizer:
      return Option.none();
  }
}
