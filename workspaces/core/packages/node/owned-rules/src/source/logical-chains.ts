import { Visitor } from 'oxc-parser';
import type {
  BlockStatement,
  CallExpression,
  ClassBody,
  LogicalExpression,
  ObjectExpression,
  Program,
  Span,
} from 'oxc-parser';
import type { CountedChain } from './types.ts';

/** A file's outermost chains with their counts, and each `Boolean(…)` call that only restarts a count. */
type LogicalChains = { readonly chains: ReadonlyArray<CountedChain>; readonly restarts: ReadonlyArray<CallExpression> };

/** The callee whose call only restarts a count when its argument is a chain, as the source writes it. */
const RESTARTING_CALLEE = 'Boolean';

/** A parsed file, and its text. */
type LogicalChainsInput = { readonly program: Program; readonly text: string };

type CountPartsInput = { readonly program: Program };

/**
 * What a file's counts are made of: each chain of logical operators and each call. Each node that starts its own count
 * follows the starts around it.
 */
type CountParts = {
  readonly chains: ReadonlyArray<LogicalExpression>;
  readonly starts: ReadonlyArray<Span>;
  readonly calls: ReadonlyArray<CallExpression>;
};

/** A node whose count is sought. */
type CountStartInput = { readonly node: Span };

/** A node, and a span that may hold it. */
type WithinInput = { readonly node: Span; readonly span: Span };

/** A node, and a chain of logical operators that may count it. */
type CountedInput = { readonly node: Span; readonly chain: LogicalExpression };

/**
 * Each outermost chain of logical operators a file holds, with the operators its count holds, and each `Boolean(…)`
 * call that only restarts a count inside a chain. As contract 012 counts them, every operator nested in a chain counts
 * with it. A call's callee and arguments, an object literal's properties, and a block or class body start their own.
 */
export function logicalChains({ program, text }: LogicalChainsInput): LogicalChains {
  const { chains, starts, calls } = countParts({ program });

  /** Whether the node lies within the span, its ends included. */
  const isWithin: (input: WithinInput) => boolean = ({ node, span }) =>
    span.start <= node.start && node.end <= span.end;

  /** Where the count that holds a node starts: the innermost start around it, which the parser reaches last. */
  const countStart: (input: CountStartInput) => number = ({ node }) =>
    starts.findLastIndex((start) => isWithin({ node, span: start }));

  /** Whether a chain counts another node: the node lies inside it, and both counts start at one place. */
  const isCounted: (input: CountedInput) => boolean = ({ node, chain }) =>
    node !== chain && isWithin({ node, span: chain }) && countStart({ node }) === countStart({ node: chain });

  /** Whether a chain is the outermost of its count, which no other chain counts. */
  const isOutermost: (chain: LogicalExpression) => boolean = (chain) =>
    !chains.some((outer) => isCounted({ node: chain, chain: outer }));

  /** An outermost chain, and the operators its count holds: its own and one for each chain it counts. */
  const countedChain: (chain: LogicalExpression) => CountedChain = (chain) => ({
    chain,
    count: chains.filter((node) => isCounted({ node, chain })).length + 1,
  });

  /** Whether a call only restarts a count: a `Boolean` of a chain, inside another chain. */
  const isRestart: (call: CallExpression) => boolean = (call) =>
    text.slice(call.callee.start, call.callee.end) === RESTARTING_CALLEE &&
    chains.some((chain) => call.arguments.includes(chain)) &&
    chains.some((chain) => isCounted({ node: call, chain }));

  return { chains: chains.filter(isOutermost).map(countedChain), restarts: calls.filter(isRestart) };
}

/**
 * Each chain, call and node that starts its own count: a call's callee and arguments, an object literal's properties,
 * and each block and class body. A start is kept before every start inside it.
 */
function countParts({ program }: CountPartsInput): CountParts {
  const chains: Array<LogicalExpression> = [];
  const starts: Array<Span> = [];
  const calls: Array<CallExpression> = [];

  /** Keeps a chain of logical operators. */
  const keepChain: (node: LogicalExpression) => void = (node) => {
    chains.push(node);
  };

  /** Keeps a call, whose callee and each argument start their own count. */
  const keepCall: (node: CallExpression) => void = (node) => {
    calls.push(node);
    starts.push(node.callee, ...node.arguments);
  };

  /** Keeps each property of an object literal, which starts its own count. */
  const keepProperties: (node: ObjectExpression) => void = (node) => {
    starts.push(...node.properties);
  };

  /** Keeps a block or class body, whose statements each start their own count. */
  const keepBody: (node: BlockStatement | ClassBody) => void = (node) => {
    starts.push(node);
  };

  new Visitor({
    LogicalExpression: keepChain,
    CallExpression: keepCall,
    ObjectExpression: keepProperties,
    BlockStatement: keepBody,
    ClassBody: keepBody,
  }).visit(program);

  return { chains, starts, calls };
}
