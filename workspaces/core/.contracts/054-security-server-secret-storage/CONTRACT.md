---
name: security-server-secret-storage
message: Encrypt held secrets bound to their record, keep keys outside the database, and never log secret values.
paths: ["packages/worker/*/src/**", "packages/worker/app/wrangler.jsonc", "packages/worker/app/cloudflare.example.jsonc", "packages/node/stack/src/**", "packages/node/deploy*/src/**"]
---

## Rules

Encrypt every upstream credential and other held secret with authenticated encryption before storing it.
Never reuse a nonce under the same key, such as by drawing a fresh random nonce for every encryption.
Bind each ciphertext to its owning record through associated data, such as the record and owner IDs, so it cannot be moved to another record.
Derive the associated data from the record being read, never from values stored beside the ciphertext.
Store the key version with each ciphertext, and keep earlier versions able to decrypt until their ciphertexts are re-encrypted.
Keep encryption keys outside the database that holds the ciphertext.
Use a distinct key for each purpose and application; never reuse an encryption key for signing or across applications.

Supply production secrets through the deployment's secret store, never through source, public configuration, or built assets.
Decrypt a secret only in the component that uses it, and never return it to clients.
Keep held secrets out of public records, API responses, browser storage, server-rendered pages, logs, audit records, error messages, and release artifacts.
Refer to secret-holding records by identifier in logs and audit records.

Give the runtime database credential data access to its own schema only, with no schema-change rights.
Run migrations and data publication with a separate credential that the runtime never receives.

## Checks

Copy a ciphertext to another record and confirm decryption fails.
Inspect the runtime's database grants and confirm it cannot change schema or read other schemas or migration state.
Confirm encryption keys are absent from the database and the migration credential is absent from the runtime environment.
Search logs, audit records, error responses, rendered pages, and built artifacts for secret values and credential-bearing URLs.
Rotate the key version and confirm existing ciphertexts still decrypt until re-encrypted.

## Local adaptations

The Worker holds the GitHub OAuth secret, model upstream key, Tensorlake project key and configured integration credentials; local deployments may hold a bootstrap secret, and test host stacks additionally use a launcher key. Deployment secrets supply the production values; local stack credentials are private files of mode 0600.
The local bootstrap secret is stable within its owner-only state directory. The server prints its file path, never its value. Only the loopback sign-in handler reads its redacted setting, and neither the model nor its guest receives it.
The settings keep credentials redacted; only the code exchange reads the client secret, and the key reaches pi-ai only through its auth resolution, never through pi's stream settings, which pi stores in every request's checkpoint.
The stack draws a fresh launcher key per stack, which only the sandbox's host provider presents; the launcher refuses every other bearer.
No secret enters a sandbox: a machine starts with only its id, and an execution sees only `PATH`, its home and fixed variables.
The token scan looks for the staged keys, the model upstream's and the launcher's, in each object's own database, every file of the sandboxes' machines, the Worker's log and every command's output; celld redacts the staged variables in an object's console output, so the scan cannot see an object that logs one; celld's own record of the deployment holds the staged variables, as a deployment's secret store does.
Persistent local mode keeps operator credentials in `.dev.vars` and celld's deployment record inside its state directory of mode 0700; `.dev.vars` and the local bootstrap secret have mode 0600. Every exit retains that directory, including the complete `.celld/dev` state; only `reset --confirm` removes initialized local state. Disposable fixture and smoke runs remove staged variables on failure while preserving diagnostics, and remove the whole temporary directory on a successful or interrupted exit.
The directory stores no secret: keys, poll tokens, browser sessions and sign-in states are stored as SHA-256 hashes, so no record carries a ciphertext and no encryption key exists yet.
`MECHANE_INTEGRATION_SECRETS` maps workspace ids to named credentials and decodes into redacted server settings. Remote connection records hold an MCP endpoint and optional credential reference; mech grants hold allowed tool names. The trusted integrations package resolves a reference for its workspace and exposes the bearer only to the HTTP client constructing `Authorization`. No integration credential enters the model, guest, durable records or checkpoints. Remote failures use constant messages, and remote metadata and results redact exact matches to configured credentials.
Slack installation metadata names separate signing, bot and history credential references in that same workspace-scoped map. The signing secret is used only to verify the raw request's HMAC and timestamp, and the bot token only in an HTTP authorization header to the configured Slack origin. Outbound content is the reply or watch summary for its trusted bound channel and thread, never installation metadata or credentials; provider failures expose only sanitized error codes.
No page, response or message quotes a token or a body that can hold one.
A Durable Object's store runs its own migrations, so there is no separate runtime or migration credential.
A deploy uploads the Worker secrets selected by the installation's `secret_refs` with `wrangler deploy --secrets-file`, from an owner-only temporary file that its scope removes. The installation stores environment-variable names, never their credential values. The Tensorlake key authenticates requests at the provider proxy, which strips it before forwarding to the guest; image builds receive it only in the SDK child environment.
The deploy program's members, `packages/node/deploy*/src`, hold the operator's credentials, the secrets file, the rendered variables that refuse a secret and private image publication, so the paths name them all.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
