---
name: security-server-secret-storage
message: Encrypt held secrets bound to their record, keep keys outside the database, and never log secret values.
paths: ["packages/worker/*/src/**", "packages/worker/app/wrangler.jsonc", "packages/node/stack/src/**", "infrastructure/**"]
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

The Worker holds the GitHub OAuth secret, model upstream key and configured integration credentials. An installation using Tensorlake additionally holds its project key. Local deployments may hold a bootstrap secret, and test host stacks additionally use a launcher key. Deployment secrets supply the production values; local stack credentials are private files of mode 0600.
The local bootstrap secret is stable within its owner-only state directory. The server prints its file path, never its value. Only the loopback sign-in handler reads its redacted setting, and neither the model nor its guest receives it.
The settings keep credentials redacted; only the code exchange reads the client secret, and the key reaches pi-ai only through its auth resolution, never through pi's stream settings, which pi stores in every request's checkpoint.
The stack draws a fresh launcher key per stack, which only the sandbox's host provider presents; the launcher refuses every other bearer.
Machine startup and ordinary executions receive no service or integration credentials. Executions see only `PATH`, their home, fixed execution variables and paths to Cloudflare's injected public CA certificate when present.
Trusted private-source preparation may give a short-lived repository token to a fresh container guest that has never run agent code. Its durable source fence blocks ordinary commands until revocation or confirmed expiry. Trusted Git receives the token only in its isolated process environment; logs, receipts, archives and model-visible results never contain it.
The outbound gateway injects no credential. It validates URL and Host authority, forwards only to declared package hosts over TLS, removes proxy authorization, and follows no redirect. Both ordinary command children and trusted Git use the same fixed certificate path without disabling TLS verification.
The token scan looks for the staged keys, the model upstream's and the launcher's, in each object's own database, every file of the sandboxes' machines, the Worker's log and every command's output; celld redacts the staged variables in an object's console output, so the scan cannot see an object that logs one; celld's own record of the deployment holds the staged variables, as a deployment's secret store does.
Persistent local mode keeps operator credentials in `.dev.vars` and celld's deployment record inside its state directory of mode 0700; `.dev.vars` and the local bootstrap secret have mode 0600. Every exit retains that directory, including the complete `.celld/dev` state; only `reset --confirm` removes initialized local state. Disposable fixture and smoke runs remove staged variables on failure while preserving diagnostics, and remove the whole temporary directory on a successful or interrupted exit.
The directory stores only SHA-256 hashes of keys, poll tokens, browser sessions and sign-in states. Workspace stores additionally hold encrypted integration credentials; they never hold the credential keyring.
Workspace credential records store AES-256-GCM ciphertext with a fresh 96-bit nonce and its key version. Associated data binds the application purpose, trusted workspace ID and credential reference. The trusted integrations package decrypts only for its provider client; owner-only write operations and metadata-only lists expose no read-value API. Remote connection records and grants contain references and permissions, never values. Schema failures, provider failures and model-visible results must not reveal credentials.
Slack installations are workspace records whose signing, bot and optional history references resolve through that workspace’s encrypted store. The signing secret verifies the raw request HMAC and timestamp; bot and history tokens authenticate only the configured Slack origin. Delivery content contains the reply or watch summary for its trusted bound channel and thread, never credentials.
No page, response or message quotes a token or a body that can hold one.
A Durable Object's store runs its own migrations, so there is no separate runtime or migration credential.
The cloud module binds OAuth, model and keyring entries by Secrets Store ID and secret name. It accepts no secret values. Runtime settings resolve Secrets Store bindings on use; local settings accept redacted strings. Workspace credentials enter through authenticated write-only APIs and never through infrastructure configuration. The optional Tensorlake key remains confined to its provider proxy and never reaches the guest.
Provider diagnostics must omit credential headers and response bodies. Release artifacts contain code, checksums and public metadata only.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
