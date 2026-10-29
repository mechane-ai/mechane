---
name: security-cli-credential-lifecycle
message: Store CLI credentials owner-only and atomically, bound to their origin, and never print them or accept them as arguments.
paths: ["packages/node/cli/src/**", "packages/shared/client/src/**"]
---

## Rules

Store only the service's own credential and its metadata, never upstream provider credentials.
Make credential files readable and writable only by their owner.
Replace credential files atomically.
Bind each stored credential to the origin that issued it, and send it only to that origin.
Send credentials only over TLS, except to a loopback address during development.
Reject redirects on authenticated requests.
Do not extract or copy credentials owned by another tool; use that tool's own authenticated interface.

Read secrets from a file or standard input, never from a literal command-line argument.
Apply the same validation and private, atomic storage to imported credentials as to issued ones.
Never print tokens or request headers, including in error and import-failure output.
Print a new credential's metadata, file path, and expiry instead of its secret.
Keep the active login when creating an additional credential.

Show the actual expiry after login, and the server origin and scope in status output.
Explain how to replace saved credentials and automation secrets when a credential is expired, revoked, or invalid.
On logout, revoke the credential on the server before deleting it locally.
Forget a credential locally when the server rejects it as unauthenticated, and retain it after network errors and failed revocations.
Do not claim remote revocation when the server only rejected authentication or when an import replaced local credentials.

## Checks

Inspect the credential file's permissions, and confirm writes go through a temporary file and an atomic rename.
Point a saved credential at another origin and at a redirecting endpoint, and confirm the CLI does not send it.
Run login, key creation, import, and failure paths, and search stdout, stderr, and process arguments for the secret.
Simulate an unauthenticated response, a network error, and a failed revocation during logout, and inspect what remains on disk and what the CLI reports.
Does any command define an argument that takes a secret value?

## Local adaptations

The saved login is `$XDG_CONFIG_HOME/mechane/credentials.json`, or `~/.config/mechane/credentials.json`, with the key's token and metadata, the principal and the origin; `packages/node/cli-login/src/store` writes it to a fresh file and renames it, in a 0700 folder with mode 0600.
A command sends the saved key only to the origin it was saved for, and any key only over HTTPS or over plain HTTP to `127.0.0.1`, `localhost` or `[::1]`; the client answers a redirect as itself and never follows it.
A key reaches a command only from the saved login or `MECHANE_API_KEY`; no flag takes a secret, and no message quotes one.
`mechane key create` writes the token alone to `--key-file`, mode 0600, prints the key's metadata and expiry, and keeps the saved login.
`mechane auth login` prints the key's expiry; `mechane auth status` prints the origin, the account, the key and its expiry, and names no scope, since every key has its principal's whole scope.
A command whose saved key the deployment refuses as unauthenticated removes the saved login and says so; `mechane auth logout` revokes the key before it removes the login, and keeps it when the revocation fails.
No command imports a credential or reads another tool's yet.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
