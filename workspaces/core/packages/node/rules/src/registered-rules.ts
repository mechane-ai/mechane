import type { ContractEnforcement, ContractName, RegisteredRule } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { CONTRACTS } from './contracts.ts';

/** A contract's rules, each with the contract that declares it. */
const contractRules: (entry: readonly [ContractName, ContractEnforcement]) => ReadonlyArray<RegisteredRule> = ([
  contract,
  { rules },
]) => rules.map((rule) => ({ contract, rule }));

/** Every rule of the registry with the contract that declares it, in the order of the contracts and their rules. */
export const REGISTERED_RULES: ReadonlyArray<RegisteredRule> = Record.toEntries(CONTRACTS).flatMap(contractRules);
