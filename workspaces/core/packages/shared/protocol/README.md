# @mechane/protocol

The domain operation catalog, resource schemas, and typed failures shared by Mechane's server, console, and CLI. AI SDK
messages and streams use their native protocol instead of an envelope from this package.

Layer 1 · shared lane · data dialect · any consumer

## Use

Declare a domain operation once in `operations/<resource>/<operation>.ts` and add it to `catalog.ts`. The router,
client, and command reference derive from these declarations. Build domain wire records with `wireStruct`.

Import the bounded json-render catalog from `@mechane/protocol/presentation`; it is shared by Slack and browser
renderers. Rendering a card never grants its actions authority.

## Ownership

`operations/` owns each resource's schemas and operations. `operation/` owns admission declarations and request
decoding. `errors/` owns tagged failures and their families. `pages/`, `github/`, and `releases/` own their shared
boundary records. Sandbox maintenance schemas come from `@mechane/sandbox-wire`, shared with the compute service. The
package contains no database rows or workflow checkpoint formats.

Keep this package free of `node:` and `cloudflare:` imports. Native SDK schemas remain with their upstream owner.
