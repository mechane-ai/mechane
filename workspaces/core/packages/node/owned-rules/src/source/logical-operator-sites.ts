import type { Site } from '@mechane/checks-kernel';
import { lineAt } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { CONTRACTS } from '@mechane/rules';
import type { Span } from 'oxc-parser';
import { logicalChains } from './logical-chains.ts';
import type { CountedChain } from './types.ts';

/** The rule that caps the logical operators one expression holds. */
const LOGICAL_OPERATORS_RULE = 'logical-operators';

/** What the site of a `Boolean(…)` call that only restarts a count asks for. */
const RESTART_MESSAGE =
  'Bind the inner chain to a named boolean rather than a `Boolean` call that only restarts the count, such as `const isDelivered = isOpen && isShipped`';

type LogicalOperatorSitesInput = { readonly source: ParsedSource };

/** A node where a site starts, and what the site asks for. */
type SiteAt = { readonly node: Span; readonly message: string };

/**
 * Each expression that holds more logical operators than `logicalOperators`, at its outermost chain, and each
 * `Boolean(…)` call whose argument is a chain inside another chain.
 */
export function logicalOperatorSites({ source }: LogicalOperatorSitesInput): ReadonlyArray<Site> {
  const { logicalOperators } = CONTRACTS['code-conditional-expressions'].values;
  const { chains, restarts } = logicalChains({ program: source.parsed.program, text: source.text });

  /** The site that starts at a node. */
  const site: (at: SiteAt) => Site = ({ node, message }) => ({
    rule: LOGICAL_OPERATORS_RULE,
    file: source.path,
    line: lineAt({ text: source.text, offset: node.start }),
    message,
  });

  /** The site of an outermost chain whose count holds more operators than the maximum. */
  const overSites: (counted: CountedChain) => ReadonlyArray<Site> = ({ chain, count }) => {
    if (count <= logicalOperators) {
      return [];
    }

    const message = `Bind part of the expression to a named boolean or a guard clause, since it holds ${String(count)} logical operators and ${String(logicalOperators)} is the most, such as \`const isDeliverable = order.isPaid && order.isShipped\``;

    return [site({ node: chain, message })];
  };

  return [...chains.flatMap(overSites), ...restarts.map((call) => site({ node: call, message: RESTART_MESSAGE }))];
}
