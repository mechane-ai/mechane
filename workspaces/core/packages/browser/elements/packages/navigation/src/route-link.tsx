import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { ComponentProps, ReactNode } from 'react';

type RouteLocation = { readonly current: ComponentProps<'a'>['aria-current'] };

function locationState({ current }: RouteLocation) {
  return { current: current ?? null };
}

const routeLink = definePrimitive({
  name: 'navigation-link',
  options: { current: 'value' },
  state: locationState,
  sync: locationState,
  controlled: ['current'],
  api: () => ({}),
  slots: (slot) => ({ root: slot({}) }),
});

const parts = createParts(routeLink, { root: 'a' });

export function RouteLink(props: ComponentProps<'a'>): ReactNode {
  if (props.href === undefined) {
    return <a {...props} />;
  }

  return <parts.Root current={props['aria-current']} render={<a {...props} />} />;
}
