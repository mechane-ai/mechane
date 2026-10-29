# @mechane/pages

The public homepage and browser pages: device approval, GitHub and local sign-in, browser sessions and HTML.

Layer 5 · worker · effect · consumers: `@mechane/app` · confines: `cookie`

## Layout

- `device/`: the device page, which asks for the code, reviews its approval and approves it.
- `sign-in/`: the GitHub sign-in, from the redirect that starts it to the callback page that opens a browser session.
- `github/`: the OAuth client, the one place that calls GitHub.
- `local-sign-in/`: the owner secret form, available only on the configured loopback origin.
- `session/`: browser sessions, their cookies and the CSRF token of their forms.
- `html/`: the layout and headers every page shares, and a form's hidden fields.
- `show-home-page.ts` serves the CLI's installation and login instructions at `/`.
- `refusal-page.ts` is the table of every failure's page, and `find-page.ts` routes a request to its page.

## Use

- `findPage` answers a browser's request for a page once its address limit lets it through, with every failure answered
  as a page of its own.

## Never

- Never approve a device approval for a key or for another site: only a same-origin form with its session's CSRF token
  approves.
- Never put a code, a state or a token in a URL a page links to, and never cache a page.
- Never render a value into markup without escaping it.
- Never send the local bootstrap secret in a URL or return it in a page; it only opens a browser session.
