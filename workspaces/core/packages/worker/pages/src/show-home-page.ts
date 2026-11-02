import { installScriptUrl, PagePath } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Effect } from 'effect';
import { renderPage } from './html/render-page.ts';
import type { PageInput } from './types.ts';

/** The public starting point for the console and CLI. */
export const showHomePage: (input: PageInput) => Effect.Effect<Response> = ({ settings }) => {
  const installer = installScriptUrl({ origin: settings.origin });
  const install = escapeHtml({ text: `curl -fsSL ${installer.href} | sh` });

  const start = escapeHtml({
    text: `export MECHANE_ORIGIN='${settings.origin.origin}'\nmechane auth login\nmechane mech create --name scout`,
  });

  const device = escapeHtml({ text: PagePath.Device });
  const console = escapeHtml({ text: PagePath.Console });

  const body = [
    '<p>Persistent agents you control from the console or your terminal.</p>',
    `<p><a href="${console}">Open the console</a></p>`,
    '<h2>Install the CLI</h2>',
    `<pre><code>${install}</code></pre>`,
    '<h2>Start a conversation</h2>',
    `<pre><code>${start}</code></pre>`,
    '<p>Follow the terminal’s sign-in link, then use the CLI to send messages and follow your agents.</p>',
    `<p><a href="${device}">Approve a CLI login</a></p>`,
  ].join('\n');

  const response = renderPage({ status: HttpStatusCode.Ok, title: 'Mechane', body, headers: [] });

  return Effect.succeed(response);
};
