import type { Site } from '@mechane/checks-kernel';
import { NodeType } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Option } from 'effect';
import type { CallExpression, VariableDeclarator, VisitorObject } from 'oxc-parser';
import { Visitor } from 'oxc-parser';
import { EFFECT_FUNCTION } from './constants.ts';
import { spanSite } from './span-site.ts';

type SpanNameSitesInput = { readonly source: ParsedSource };

/** A binding or property's name, and the call it holds. */
type Bound = { readonly binding: string; readonly expression: CallExpression };

/** A call and the text of the file it sits in. */
type EffectFunctionCallInput = { readonly expression: CallExpression; readonly text: string };

/**
 * Each `Effect.fn` held by a binding or a property whose span name is missing or differs from that name, so a trace
 * names the function a reader finds under it.
 */
export function spanNameSites({ source }: SpanNameSitesInput): ReadonlyArray<Site> {
  const { text, parsed } = source;
  const bound: Array<Bound> = [];

  /** Keeps a declarator that binds a name to a call. */
  const keepDeclarator: (node: VariableDeclarator) => void = (node) => {
    const init = Option.fromNullishOr(node.init);

    if (node.id.type === NodeType.Identifier && Option.isSome(init) && init.value.type === NodeType.CallExpression) {
      bound.push({ binding: node.id.name, expression: init.value });
    }
  };

  /** Keeps a property whose name is written out and whose value is a call. */
  const keepProperty: NonNullable<VisitorObject['Property']> = (node) => {
    if (node.key.type === NodeType.Identifier && !node.computed && node.value.type === NodeType.CallExpression) {
      bound.push({ binding: node.key.name, expression: node.value });
    }
  };

  new Visitor({ VariableDeclarator: keepDeclarator, Property: keepProperty }).visit(parsed.program);

  /** The site of a bound `Effect.fn` whose span is not named for its binding. */
  const boundSites: (held: Bound) => ReadonlyArray<Site> = ({ binding, expression }) =>
    Option.toArray(effectFunctionCall({ expression, text })).flatMap((call) => spanSite({ binding, call, source }));

  return bound.flatMap(boundSites);
}

/** The `Effect.fn` call a call makes, `Effect.fn('name')` of `Effect.fn('name')(…)` or a bare `Effect.fn(…)`. */
function effectFunctionCall({ expression, text }: EffectFunctionCallInput): Option.Option<CallExpression> {
  const { callee } = expression;

  if (text.slice(callee.start, callee.end) === EFFECT_FUNCTION) {
    return Option.some(expression);
  }

  if (
    callee.type === NodeType.CallExpression &&
    text.slice(callee.callee.start, callee.callee.end) === EFFECT_FUNCTION
  ) {
    return Option.some(callee);
  }

  return Option.none();
}
