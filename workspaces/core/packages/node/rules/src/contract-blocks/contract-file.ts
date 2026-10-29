import type { ContractEnforcement, Rule } from '@mechane/rule-shapes';
import { Array, Option, Record } from 'effect';
import { CONTRACTS } from '../contracts.ts';
import type { ContractText, ExitStatus, GeneratedFile } from '../types.ts';
import { isFlatValue } from './is-flat-value.ts';
import { ruleText } from './rule-text.ts';
import { valueSentence } from './value-sentence.ts';

/** The contract whose block states the CLI's exit statuses, which the generator reads from the command reference. */
const EXIT_STATUS_CONTRACT = 'cli-output-channels';

/** The heading that starts a contract's local adaptations, at whose end the generated block sits. */
const ADAPTATIONS_HEADING = '## Local adaptations';

/** The comments that open and close a contract's generated block, which `mise run fix` rewrites whole. */
const ContractBlock = {
  Start: '<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->',
  End: '<!-- End of the generated block. -->',
} as const;

type ContractFileInput = { readonly contract: ContractText; readonly exitStatuses: ReadonlyArray<ExitStatus> };

/** A contract's registry entry, and the facts its block states from the tree. */
type BlockLinesInput = { readonly enforcement: ContractEnforcement; readonly facts: ReadonlyArray<string> };

/** One value of a contract's entry, by its key. */
type ValueEntry = readonly [string, unknown];

/**
 * A contract's file with its generated block at the end of its local adaptations. The block states the values its
 * registry entry declares, the facts it reads from the tree, and the rules that decide it. A contract without local
 * adaptations gains the heading.
 */
export function contractFile({ contract, exitStatuses }: ContractFileInput): ReadonlyArray<GeneratedFile> {
  const { name, path, text } = contract;
  const entries = new Map<string, ContractEnforcement>(Record.toEntries(CONTRACTS));

  const facts: ReadonlyArray<string> = (() => {
    if (name !== EXIT_STATUS_CONTRACT) {
      return [];
    }

    const exitStatusText: (exit: ExitStatus) => string = (exit) => `\`${exit.name}\` ${String(exit.status)}`;

    const statuses = exitStatuses.map(exitStatusText).join(', ');

    return [`The CLI's exit statuses, as its command reference publishes them: ${statuses}.`];
  })();

  const blockFile: (enforcement: ContractEnforcement) => GeneratedFile = (enforcement) => {
    const lines = blockLines({ enforcement, facts });
    const block = [ContractBlock.Start, '', ...lines, '', ContractBlock.End, ''].join('\n');
    const start = text.indexOf(ContractBlock.Start);

    if (start !== -1) {
      return { path, text: `${text.slice(0, start)}${block}` };
    }

    if (text.includes(ADAPTATIONS_HEADING)) {
      return { path, text: `${text}\n${block}` };
    }

    return { path, text: `${text}\n${ADAPTATIONS_HEADING}\n\n${block}` };
  };

  return Option.toArray(Option.fromNullishOr(entries.get(name))).map(blockFile);
}

/**
 * The block's paragraphs: the flat values, the values the generated configurations carry, the facts, and one line per
 * rule.
 */
function blockLines({ enforcement, facts }: BlockLinesInput): ReadonlyArray<string> {
  const entries = Record.toEntries(enforcement.values);
  const flat = entries.filter(([, value]) => isFlatValue({ value }));
  const isNested: (entry: ValueEntry) => boolean = ([, value]) => !isFlatValue({ value });
  const keyInCode: (entry: ValueEntry) => string = ([key]) => `\`${key}\``;
  const nested = entries.filter(isNested).map(keyInCode);
  const valueText: (entry: ValueEntry) => string = ([key, value]) => `\`${key}\` ${valueSentence({ value })}`;
  const values = flat.map(valueText);
  const parts: ReadonlyArray<ReadonlyArray<unknown>> = [values, nested, facts, enforcement.rules];

  if (parts.every(Array.isReadonlyArrayEmpty)) {
    return ['No rule of the registry decides this contract; review does.'];
  }

  const valuesLine: (listed: Array.NonEmptyReadonlyArray<string>) => ReadonlyArray<string> = (listed) => [
    `Values: ${listed.join('; ')}.`,
  ];

  const nestedLine: (listed: Array.NonEmptyReadonlyArray<string>) => ReadonlyArray<string> = (listed) => [
    `The generated configurations carry ${listed.join(', ')}.`,
  ];

  const ruleLine: (rule: Rule) => string = (rule) => `- ${ruleText({ rule })}`;

  return [
    ...Array.match(values, { onEmpty: () => [], onNonEmpty: valuesLine }),
    ...Array.match(nested, { onEmpty: () => [], onNonEmpty: nestedLine }),
    ...facts,
    ...enforcement.rules.map(ruleLine),
  ];
}
