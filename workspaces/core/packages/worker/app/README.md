# @mechane/app

The Worker entry module and shared configuration used to build releases and run local installations.

Layer 7 · worker · effect · consumers: none

## Use

- `worker.ts` is the Worker's `main`: it exports every Durable Object class and runs `serve` once per request.
- `serve` answers a page, the install script, a release file or a catalog operation. Every failure becomes the error
  response its family fixes. Hostname aliases redirect to the configured origin before sign-in sets a cookie.
- `wrangler.jsonc` declares the local bindings and append-only Durable Object migrations. The release packager uses its
  defaults and class declarations in the [Cloudflare installation module](../../../docs/self-hosting.md).

## Never

- Never handle an operation or a page here: the edge and the pages own them.
- Never change a deployed Durable Object migration; append one.
