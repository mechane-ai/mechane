import { Visitor } from 'oxc-parser';
import type { TSAsExpression, TSSatisfiesExpression, TSTypeAssertion } from 'oxc-parser';
import type { StatementSpan } from '../types.ts';
import type { ProgramInput } from './types.ts';

/** An expression that asserts or checks a type it names. */
type AssertingNode = TSAsExpression | TSSatisfiesExpression | TSTypeAssertion;

/**
 * The spans that stand in a type: annotations, type arguments and parameters, type declarations, and the types that
 * assertions name.
 */
export function typeSpans({ program }: ProgramInput): ReadonlyArray<StatementSpan> {
  const spans: Array<StatementSpan> = [];

  /** Keeps the span of a node that stands in a type. */
  const keepSpan: (node: StatementSpan) => void = (node) => {
    spans.push(node);
  };

  new Visitor({
    TSTypeAnnotation: keepSpan,
    TSTypeParameterInstantiation: keepSpan,
    TSTypeParameterDeclaration: keepSpan,
    TSTypeAliasDeclaration: keepSpan,
    TSInterfaceDeclaration: keepSpan,
    TSClassImplements: keepSpan,
  }).visit(program);

  return [...spans, ...annotationSpans({ program })];
}

/** The types that `as`, `satisfies` and an angle-bracket assertion name. */
function annotationSpans({ program }: ProgramInput): ReadonlyArray<StatementSpan> {
  const spans: Array<StatementSpan> = [];

  /** Keeps the span of the type an assertion names. */
  const keepAnnotation: (node: AssertingNode) => void = (node) => {
    spans.push(node.typeAnnotation);
  };

  new Visitor({
    TSAsExpression: keepAnnotation,
    TSSatisfiesExpression: keepAnnotation,
    TSTypeAssertion: keepAnnotation,
  }).visit(program);

  return spans;
}
