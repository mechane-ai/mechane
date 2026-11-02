import { ClientOnly, createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
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
    <p>
      Page not found. <a href="/console">Open the console</a>
    </p>
  ),
});

function Root({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ClientOnly>{children}</ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}
