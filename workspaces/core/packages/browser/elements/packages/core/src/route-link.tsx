import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentProps, ComponentType, ReactNode } from 'react';

type LinkOptions = { readonly destination: string | undefined; readonly current: ComponentProps<'a'>['aria-current'] };

function linkState({ destination, current }: LinkOptions) {
  return { href: destination ?? null, current: current ?? null };
}

const link = definePrimitive({
  name: 'link',
  options: { destination: 'string', current: 'value' },
  state: linkState,
  sync: linkState,
  controlled: ['href', 'current'],
  api: (context) => ({
    /** Follows the link as a press does, so the application's router and the browser decide what happens. */
    follow: () => context.element('root')?.click(),
  }),
  slots: (slot) => ({ root: slot({}) }),
  agent: { actions: ['follow'] },
});

/** The anchor behind every Elements link. An agent reads its destination and whether it is current, and follows it. */
export const Link: ComponentType<Omit<PartProps<'a'>, 'id'> & LinkOptions> = createParts(link, { root: 'a' }).Root;

/** A native anchor for an application's routes. Without a destination it stays a plain anchor. */
export function RouteLink(props: ComponentProps<'a'>): ReactNode {
  if (props.href === undefined) {
    return <a {...props} />;
  }

  return <Link destination={props.href} current={props['aria-current']} render={<a {...props} />} />;
}
