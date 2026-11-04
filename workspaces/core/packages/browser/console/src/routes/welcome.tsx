import { SkipLink } from '@mechane-ai/ui';
import { createFileRoute } from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { Welcome } from '../entrance.tsx';
import css from '../styles.css?url';

// This build-time document needs only the same stylesheet and sign-in link as an expired session.
export const Route = createFileRoute('/welcome')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `<!doctype html>${renderToStaticMarkup(
            <html lang="en">
              <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Mechane Console</title>
                <link rel="stylesheet" href={css} />
              </head>
              <body>
                <SkipLink href="#main">Skip to content</SkipLink>
                <Welcome />
              </body>
            </html>,
          )}`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        ),
    },
  },
});
