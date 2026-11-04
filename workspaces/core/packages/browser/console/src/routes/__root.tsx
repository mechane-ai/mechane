import { EmptyState, SkipLink, TextLink } from '@mechane-ai/ui';
import { ClientOnly, createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ConsoleEntrance } from '../entrance.tsx';
import css from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Mechane Console' },
    ],
    links: [{ rel: 'stylesheet', href: css }],
  }),
  shellComponent: Root,
  component: Outlet,
  notFoundComponent: () => (
    <ConsoleEntrance>
      <EmptyState title="Page not found" action={<TextLink href="/console">Open the console</TextLink>} />
    </ConsoleEntrance>
  ),
});

function Root({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SkipLink href="#main">Skip to content</SkipLink>
        <ClientOnly fallback={<ConsoleEntrance />}>{children}</ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}
