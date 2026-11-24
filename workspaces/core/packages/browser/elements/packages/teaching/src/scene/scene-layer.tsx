import * as stylex from '@stylexjs/stylex';
import { use } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { SceneSetupContext } from './scene-context.ts';
import { fillLabel } from './scene-validate.ts';

/** SVG layers under the nodes, back to front: outlines and halos, wires, then brackets, leaders and custom marks. */
export type SceneLayerName = 'back' | 'wires' | 'front';

const styles = stylex.create({
  error: { color: colors.danger, fontFamily: typography.fontFamily, fontWeight: typography.strongWeight },
  inline: { position: 'absolute', left: 0, top: 0, display: 'block', overflow: 'hidden', pointerEvents: 'none' },
});

/** Inline layers sit under every HTML part, back to front, as the shared layers do once the scene has mounted. */
const depths = stylex.create({ back: { zIndex: -1003 }, wires: { zIndex: -1002 }, front: { zIndex: -1001 } });

/**
 * Draws SVG for the parts that draw lines and outlines into one of the scene's layers, under the HTML nodes, in plot
 * pixels. Before the scene mounts, as on the server, it draws in its own SVG element, so the first markup holds every
 * wire and curve. It draws nothing outside a scene.
 */
export function SceneLayer({
  layer = 'front',
  children,
}: {
  readonly layer?: SceneLayerName | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const { layers, box, isInScene } = use(SceneSetupContext);
  const element = layers[layer];

  if (!isInScene) {
    return null;
  }

  if (element !== null) {
    return createPortal(children, element);
  }

  return (
    <svg
      aria-hidden
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
      {...stylex.props(styles.inline, depths[layer])}
    >
      {children}
    </svg>
  );
}

/** The inline error a scene part shows when it is rendered outside any `Scene`. */
export function SceneOutside({ part }: { readonly part: string }): ReactNode {
  const { labels } = use(SceneSetupContext);

  return <span {...stylex.props(styles.error)}>{fillLabel(labels.outside, { part })}</span>;
}
