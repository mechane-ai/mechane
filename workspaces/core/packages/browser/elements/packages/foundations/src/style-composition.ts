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
  | 'marginBlockStart'
  | 'marginBlockEnd'
  | 'marginInlineStart'
  | 'marginInlineEnd'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'marginLeft'
  | 'width'
  | 'maxWidth'
  | 'minWidth'
>;

type DefinedProperties<Properties> = { readonly [Key in keyof Properties]?: Exclude<Properties[Key], undefined> };

export type PlacementStyle = StyleXStyles<DefinedProperties<PlacementProperties>>;

type StyleProperties<State> = {
  readonly className?: string | ((state: State) => string | undefined) | undefined;
  readonly style?: CSSProperties | ((state: State) => CSSProperties | undefined) | undefined;
};

type CompiledStyles = { readonly className?: string | undefined; readonly style?: CSSProperties | undefined };
type MergeStylesInput<State> = StyleProperties<State> & { readonly styles: CompiledStyles };

export function mergeStyles<State>({ className, style, styles }: MergeStylesInput<State>) {
  return {
    className: (state: State) =>
      [styles.className, typeof className === 'function' ? className(state) : className].filter(Boolean).join(' '),
    style: (state: State): CSSProperties => ({
      ...styles.style,
      ...(typeof style === 'function' ? style(state) : style),
    }),
  };
}
