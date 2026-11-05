import { TextLink } from '@mechane-ai/elements';
import { EmptyState, LoadingScope } from '@mechane-ai/elements/feedback';
import { SkipLink } from '@mechane-ai/elements/navigation';
import { ClientOnly, createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ConsoleEntrance, ConsolePending } from '../entrance.tsx';
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
  const location = useRouterState({ select: (state) => state.location });
  const loadingIdentity = JSON.stringify([location.href, location.state.consolePages]);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SkipLink href="#main">Skip to content</SkipLink>
        <LoadingScope identity={loadingIdentity}>
          <ClientOnly fallback={<ConsolePending />}>{children}</ClientOnly>
        </LoadingScope>
        <Scripts />
      </body>
    </html>
  );
}
