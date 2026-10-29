import { RuleTool } from '@mechane/rule-shapes';
import type { Rule } from '@mechane/rule-shapes';
import { findingKey, loadedAsset, REGISTERED_RULES, registeredName } from '@mechane/rules';
import { Option } from 'effect';

/** The tools whose findings name no rule of the standard, so each of their messages gains it, as AS-01 says. */
const UNSTATED_TOOLS: ReadonlySet<Rule['tool']> = new Set([
  RuleTool.Owned,
  RuleTool.Normalizer,
  RuleTool.Cruiser,
  RuleTool.Manifest,
]);

/** The period that ends an installed rule's message, which the library writes and AS-01's form leaves out. */
const FINAL_PERIOD = /\.$/;

/**
 * How a rule's findings end: with the rule of the standard it serves, after an installed rule's message drops its
 * period.
 */
type StandardEnding = { readonly standard: string; readonly isInstalled: boolean };

/** A finding's rule, by the name its findings count under, and its message. */
type StandardMessageInput = { readonly rule: string; readonly message: string };

/**
 * How the findings end of each rule whose tool names no rule of the standard, by the name the registry declares it
 * under. These are the owned rules, normalizers, dependency-cruiser rules and families, and the installed rules.
 */
const RULE_ENDINGS: ReadonlyMap<string, StandardEnding> = ruleEndings();

/**
 * A finding's message ended with its rule's rule of the standard, a family's for each rule the family writes, which a
 * rule the registry lacks has none of. An installed rule's message, which the library writes, drops its final period.
 */
export function standardMessage({ rule, message }: StandardMessageInput): string {
  const name = registeredName({ name: rule });
  const held = RULE_ENDINGS.get(name);
  const ending = Option.fromNullishOr(held);

  if (Option.isNone(ending)) {
    return message;
  }

  const { standard, isInstalled } = ending.value;

  if (!isInstalled) {
    return `${message} (${standard})`;
  }

  return `${message.replace(FINAL_PERIOD, '')} (${standard})`;
}

/** Each rule whose findings name no rule of the standard, by the name its findings count under, and how they end. */
function ruleEndings(): ReadonlyMap<string, StandardEnding> {
  const ruleEnding: (rule: Rule) => ReadonlyArray<readonly [string, StandardEnding]> = (rule) => {
    const loaded = loadedAsset({ rule });
    const isInstalled = Option.isSome(loaded);

    if (!isInstalled && !UNSTATED_TOOLS.has(rule.tool)) {
      return [];
    }

    const key = findingKey({ rule });

    return [[key, { standard: rule.standard, isInstalled }]];
  };

  const endings = REGISTERED_RULES.map(({ rule }) => rule).flatMap(ruleEnding);

  return new Map(endings);
}
