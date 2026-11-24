import * as stylex from '@stylexjs/stylex';
import { colors, controls } from '../../../foundations/src/tokens.stylex.ts';

const OUTLINE_THIN = 1;
const OUTLINE_THICK = 2;
const OUTLINE_GAP = 1;
const CURSOR_GAP = 3;

/** The gray of an object drawn as context, which stays visible on a dark surface. */
export const sceneContextColor = `color-mix(in srgb, ${colors.faint} 70%, ${colors.muted})`;

const outlines = stylex.create({
  inspected: {
    outlineWidth: OUTLINE_THIN,
    outlineStyle: 'solid',
    outlineColor: colors.ink,
    outlineOffset: OUTLINE_GAP,
  },
  selected: {
    outlineWidth: OUTLINE_THICK,
    outlineStyle: 'solid',
    outlineColor: colors.ink,
    outlineOffset: OUTLINE_GAP,
  },
  cursor: {
    outlineWidth: controls.focusWidth,
    outlineStyle: 'dashed',
    outlineColor: { 'default': colors.ink, '@media (forced-colors: active)': 'Highlight' },
    outlineOffset: CURSOR_GAP,
  },
});

/** Which of the scene's inspection marks an object shows now. */
export type SceneOutlineState = {
  readonly isInspected: boolean;
  readonly isSelected: boolean;
  readonly isCursor: boolean;
};

/**
 * The outlines an object drawn in HTML shows for inspection: thin while inspected, thick while selected, and a dashed
 * ring while the keyboard cursor rests on it. Every HTML part draws them alike, so a card reads like a node.
 */
export function sceneOutlines({
  isInspected,
  isSelected,
  isCursor,
}: SceneOutlineState): ReadonlyArray<stylex.StyleXStyles | false> {
  return [isInspected && outlines.inspected, isSelected && outlines.selected, isCursor && outlines.cursor];
}
