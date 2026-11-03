import { mergeProps } from '@base-ui/react/merge-props';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { CSSProperties } from 'react';

type PlacementProperties = Pick<
  CSSProperties,
  | 'alignSelf'
  | 'flex'
  | 'flexGrow'
  | 'flexShrink'
  | 'gridArea'
  | 'gridColumn'
  | 'gridRow'
  | 'margin'
  | 'marginBlock'
  | 'marginInline'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'width'
  | 'maxWidth'
  | 'minWidth'
>;

type ControlGeometry = Pick<
  CSSProperties,
  | 'height'
  | 'minHeight'
  | 'maxHeight'
  | 'padding'
  | 'paddingBlock'
  | 'paddingInline'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'borderRadius'
  | 'justifyContent'
  | 'alignItems'
  | 'gap'
>;

type DefinedProperties<Properties> = { readonly [Key in keyof Properties]?: Exclude<Properties[Key], undefined> };

export type PlacementStyle = StyleXStyles<DefinedProperties<PlacementProperties>>;
export type ControlStyle = StyleXStyles<DefinedProperties<PlacementProperties & ControlGeometry>>;

type StyleProperties<State> = {
  readonly className?: string | ((state: State) => string | undefined) | undefined;
  readonly style?: CSSProperties | ((state: State) => CSSProperties | undefined) | undefined;
};

type CompiledStyles = { readonly className?: string | undefined; readonly style?: CSSProperties | undefined };
type MergeStylesInput<State> = StyleProperties<State> & { readonly styles: CompiledStyles };

// Resolve this component's callbacks before Base UI merges its concrete classes and styles into the rendered element.
export function mergeStyles<State>({ className, style, styles }: MergeStylesInput<State>): StyleProperties<State> {
  return {
    className: (state) => {
      if (typeof className === 'function') {
        return mergeProps<'div'>(styles, { className: className(state) }).className;
      }

      return mergeProps<'div'>(styles, { className }).className;
    },
    style: (state) => {
      if (typeof style === 'function') {
        return mergeProps<'div'>(styles, { style: style(state) }).style;
      }

      return mergeProps<'div'>(styles, { style }).style;
    },
  };
}
