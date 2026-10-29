# @mechane/app

The Worker entry module, shared runtime configuration, and public Cloudflare installation example.

Layer 6 · worker · effect · consumers: none

## Use

- `worker.ts` is the Worker's `main`: it exports every Durable Object class and runs `serve` once per request.
- `serve` answers a page, the install script, a release file or a catalog operation. Every failure becomes the error
  response its family fixes. Hostname aliases redirect to the configured origin before sign-in sets a cookie.
- `wrangler.jsonc` declares the bindings and append-only Durable Object migrations. `cloudflare.example.jsonc` shows
  operator-owned resources and settings for a hosted installation.

## Never

- Never handle an operation or a page here: the edge and the pages own them.
- Never change a deployed Durable Object migration; append one.
