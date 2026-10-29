# @mechane/directory

The directory Durable Object and its decisions.

Layer 4 · worker · plain · consumers: `@mechane/app`

## Layout

- `device-approvals/`: a device login's approval by a signed-in browser, which signs an identity up once, and its claim,
  which issues the key.
- `keys/`: what a key's token reaches, read for the key cache to fill.

## Use

- `DirectoryObject` is the deployment's one directory of principals, keys, workspaces, device approvals, browser
  sessions and sign-ins. The Worker calls it by RPC with every token already hashed.
- Each method reads the clock once, decides and writes synchronously, and answers plain data the Worker decodes.
- `workspaceMembership` resolves current authority on every workspace admission, independent of the key cache.

## Never

- Never store or answer a raw token: the directory holds only SHA-256 hashes.
- Never approve a key with another key; only a browser session approves.
- Never make an outbound call: the directory decides from its own database alone.
