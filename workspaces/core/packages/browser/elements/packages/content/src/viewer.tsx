import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType } from 'react';

type ViewerKind = 'code' | 'diff' | 'json' | 'log' | 'stack-trace';

function viewerState({ kind }: { kind: ViewerKind }) {
  return { kind };
}

const viewer = definePrimitive({
  name: 'viewer',
  options: { kind: 'string' },
  state: viewerState,
  sync: viewerState,
  controlled: ['kind'],
  api: () => ({}),
  agent: { actions: [] },
  slots: (slot) => ({ root: slot({}) }),
});

/** A read-only viewer's frame. An agent finds it by its label and kind; its content stays out of the snapshot. */
export const Viewer: ComponentType<Omit<PartProps<'section'>, 'id'> & { readonly kind: ViewerKind }> = createParts(
  viewer,
  { root: 'section' },
).Root;
