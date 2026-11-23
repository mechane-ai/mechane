import { createElement } from 'react';
import type { Attributes, ReactNode } from 'react';
import { FigureInvalid } from '../figure/figure-frame.tsx';
import { figureRegistry } from './figure-registry.tsx';
import type { FigureState } from './figure-registry.tsx';
import type { FigureChart, FigureChartProps, FigureSpecOf, JsonProps } from './figure-spec.ts';
import { validateFigureSpec } from './validate-figure.ts';

export type FigureSpecProps = FigureState & {
  /** A `FigureSpec`: typed in code, or parsed from JSON an agent or a server wrote. It is checked before drawing. */
  readonly spec: unknown;
};

const INVALID_TITLE = 'Figure';
const INVALID_LOCALE = 'en-US';

function textField(input: unknown, key: string): string | undefined {
  const props = typeof input === 'object' && input !== null ? new Map<string, unknown>(Object.entries(input)) : null;
  const value = props?.get(key);

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function SpecFigure<Chart extends FigureChart>({
  spec,
  state,
}: {
  readonly spec: FigureSpecOf<Chart>;
  readonly state: FigureState;
}): ReactNode {
  const { component: Component, isSelectable } = figureRegistry[spec.chart];
  const { selected, onSelectedChange, status } = state;

  const selection: FigureState = isSelectable
    ? { ...(selected === undefined ? {} : { selected }), onSelectedChange }
    : {};

  const props: JsonProps<FigureChartProps[Chart]> & FigureState & Attributes = {
    key: spec.chart,
    ...spec.props,
    ...selection,
    ...(status === undefined ? {} : { status }),
  };

  return createElement(Component, props);
}

/**
 * Draws a figure from its spec: the registered chart, with the spec's props. Selection and other state JSON cannot
 * carry arrive beside the spec, and `status` overrides the spec's own while newer data loads. A spec that fails the
 * check draws the shared invalid figure with the reason; it never throws.
 */
export function Figure({ spec, ...state }: FigureSpecProps): ReactNode {
  const result = validateFigureSpec(spec);

  if (result.kind === 'invalid') {
    const props = typeof spec === 'object' && spec !== null ? new Map<string, unknown>(Object.entries(spec)) : null;
    const input = props?.get('props');

    return (
      <FigureInvalid
        title={textField(input, 'title') ?? INVALID_TITLE}
        locale={textField(input, 'locale') ?? INVALID_LOCALE}
        message={result.message}
      />
    );
  }

  return <SpecFigure spec={result.spec} state={state} />;
}
