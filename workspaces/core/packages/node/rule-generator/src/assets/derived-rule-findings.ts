import { RuleTool } from '@mechane/rule-shapes';
import type { ContractLock, RegisteredRule, RuleOrigin } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import type { ContractText } from '@mechane/rules';
import { Option, Record } from 'effect';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding } from '../types.ts';
import { installedFiles } from './installed-files.ts';

/** The contracts, and the lock that gives the hash of each file an installed one ships. */
type DerivedRuleFindingsInput = { readonly contracts: ReadonlyArray<ContractText>; readonly lock: ContractLock };

/**
 * Each authored rule that copies a shipped rule whose hash in `.tenet.lock` differs from the one its entry pins. An
 * update that changes the shipped rule fails until the copy is reviewed and pinned again (110).
 */
export function derivedRuleFindings({ contracts, lock }: DerivedRuleFindingsInput): ReadonlyArray<RegistryFinding> {
  const contractFindings: (contract: ContractText) => ReadonlyArray<RegistryFinding> = (contract) => {
    const installed = installedFiles({ lock, contract });

    const isStale: (origin: RuleOrigin) => boolean = ({ asset, hash }) => {
      const locked = Record.get(installed, asset);

      return !Option.contains(locked, hash);
    };

    const staleFindings: (registered: RegisteredRule) => ReadonlyArray<RegistryFinding> = ({
      contract: name,
      rule,
    }) => {
      if (name !== contract.name || rule.tool !== RuleTool.AstGrep) {
        return [];
      }

      const stale = Option.filter(rule.derivedFrom, isStale);

      const staleFinding: (origin: RuleOrigin) => RegistryFinding = ({ asset }) => ({
        path: REGISTRY,
        message: `Review ${rule.name} against ${asset} of ${contract.name}, then pin the hash \`.tenet.lock\` gives that file, such as \`hash: 'blake3:…'\` (110)`,
      });

      const findings = Option.map(stale, staleFinding);

      return Option.toArray(findings);
    };

    return REGISTERED_RULES.flatMap(staleFindings);
  };

  return contracts.flatMap(contractFindings);
}
