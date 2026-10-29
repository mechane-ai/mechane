import { installScriptUrl, PagePath } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Effect } from 'effect';
import { renderPage } from './html/render-page.ts';
import type { PageInput } from './types.ts';

/** A public starting point for the CLI, without opening a browser session until a person approves a login. */
export const showHomePage: (input: PageInput) => Effect.Effect<Response> = ({ settings }) => {
  const installer = installScriptUrl({ origin: settings.origin });
  const install = escapeHtml({ text: `curl -fsSL ${installer.href} | sh` });
  const device = escapeHtml({ text: PagePath.Device });

  const body = [
    '<p>Persistent agents you control from your terminal.</p>',
    '<h2>Install the CLI</h2>',
    `<pre><code>${install}</code></pre>`,
    '<h2>Start a conversation</h2>',
    '<pre><code>mechane auth login\nmechane mech create --name scout</code></pre>',
    '<p>Sign in with GitHub when the terminal asks, then use the CLI to send messages and follow your agents.</p>',
    `<p><a href="${device}">Approve a CLI login</a></p>`,
  ].join('\n');

  const response = renderPage({ status: HttpStatusCode.Ok, title: 'Mechane', body, headers: [] });

  return Effect.succeed(response);
};
