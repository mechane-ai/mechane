import type { Site } from '@mechane/checks-kernel';
import { lineAt, NodeType } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Array, Option } from 'effect';
import type { CallExpression } from 'oxc-parser';
import { EFFECT_FUNCTION } from './constants.ts';

/** The span-name rule: an `Effect.fn` names its span as the binding that holds it, so a trace names the function. */
const SPAN_NAME_RULE = 'span-name';

/** A binding's name, the `Effect.fn` call it holds, and the file it sits in. */
type SpanSiteInput = { readonly binding: string; readonly call: CallExpression; readonly source: ParsedSource };

/** A site of the call unless its first argument is the binding's name as a string. */
export function spanSite({ binding, call, source }: SpanSiteInput): ReadonlyArray<Site> {
  const isNamed = Option.exists(
    Array.head(call.arguments),
    (argument) => argument.type === NodeType.Literal && argument.value === binding,
  );

  if (isNamed) {
    return [];
  }

  const message = `Name the span \`${binding}\`, as its binding, such as \`${EFFECT_FUNCTION}('${binding}')\``;

  return [
    { rule: SPAN_NAME_RULE, file: source.path, line: lineAt({ text: source.text, offset: call.start }), message },
  ];
}
