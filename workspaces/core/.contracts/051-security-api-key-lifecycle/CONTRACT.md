---
name: security-api-key-lifecycle
message: Store issued keys as hashes bound to owner, scope, and expiry, revoke them permanently, and fail with distinct unauthenticated errors.
paths: ["packages/shared/protocol/src/operations/auth/**", "packages/worker/edge/src/operations/auth/**", "packages/worker/directory/src/**", "packages/worker/pages/src/**", "packages/worker/edge/src/routing/**", "packages/shared/credentials/src/**", "packages/worker/app/wrangler.jsonc", "infrastructure/modules/cloudflare/variables.tf"]
---

## Rules

Generate keys from a cryptographically secure random source.
Store only a hash of each key, with its owner, granted scope, expiry, and revocation state.
Return the key secret once, in the issuance response, and never from metadata, listing, or inspection endpoints.
Bind a purpose-specific key to its purpose, such as uploading invoices for one account, and deny every other operation.
Bind a capability key to its named resource, and recheck its issuer's access and revocation on each use.
Default new and existing keys to no optional grants.

Issue keys only through a live interactive session or an independent proof; an existing key cannot mint, approve, or extend another key.
Persist the requested scope and lifetime with the pending request, display them before approval, and do not let approval change them.
Approve an elevated grant only from a live interactive session of a principal who holds that grant.
Expire unclaimed issuance requests, and deliver an approved key once, bound to the request that asked for it.
Use one issuance, resolution, metadata, revocation, and audit path for every key kind.
Record issuance, elevated grants, and revocation with identifiers only, never the secret.

Give every key an explicit expiry within a declared maximum lifetime, and show the actual expiry after issuance.
Changing issuance defaults never extends existing keys.
Revoke keys permanently; re-enabling an owner, service, or membership never revives them.
Revoke keys derived from an identity, membership, or binding when that source changes or is removed.
Recheck the owner's current eligibility on every authentication, and fail closed when the eligibility source is unavailable.

Reject expired, revoked, and invalid keys as unauthenticated, such as HTTP 401, with distinct error codes that state how to recover.
State the actual expiry in an expired-key error.
Over HTTP, send a `WWW-Authenticate` challenge with every 401, and include the bearer `invalid_token` error only when the request supplied a credential.
Report a failed upstream credential that the server holds with an error other than unauthenticated, so clients keep their valid key.

## Checks

Inspect key storage and confirm it holds no plaintext secret and that each record carries owner, scope, expiry, and revocation state.
Authenticate with expired, revoked, malformed, and absent keys, and compare status, error code, message, and challenge header.
Revoke a key, disable and re-enable its owner, and confirm the key stays invalid.
Attempt to issue or extend a key using only an existing key and confirm refusal.
Change an issuance default and confirm existing expiries are unchanged.
Search logs, audit records, and metadata responses for key secrets.

## Local adaptations

A key is an `mk_` token of 32 bytes from `crypto.getRandomValues`; the directory's `keys` table stores its SHA-256 hash with its principal, name, purpose, and creation, expiry and revocation times.
Every key carries its principal's whole scope; `purpose` records whether a login or a named-key approval issued it, and no key has an optional grant yet.
Only a device approval issues a key: the CLI starts one without a credential, a live browser session types its user code on the device page, reviews it and approves it, and no operation accepts a key to issue, approve or extend another. No URL carries a user code, so a link cannot bring a browser to an approval it did not type.
A device approval stores its purpose, key name and key lifetime when it starts, with its peer's address and country when Cloudflare names them; the review page shows them and the approval's age, and approving changes none of them; it expires after 10 minutes. One address starts at most `device_start`'s approvals in a window.
The key is minted by the first poll after the approval, through the directory's one `issueKey`, so its token exists only in that poll's answer and is never stored; a later poll finds nothing to claim.
Issuance and revocation are recorded by id only, in the key's own row: its principal, who approved it, its purpose, and its creation and revocation times, which outlive the device approval that the directory deletes once it expires.
`MECHANE_LOGIN_KEY_LIFETIME_SECONDS` and `MECHANE_NAMED_KEY_LIFETIME_SECONDS` set each purpose's lifetime. The local defaults live in `packages/worker/app/wrangler.jsonc`. Cloud installations use `authentication.login_key_lifetime_seconds` and `authentication.named_key_lifetime_seconds` in `infrastructure/modules/cloudflare/variables.tf`. Both the module and Worker refuse lifetimes above 365 days.
Revocation keeps its first time and is permanent. A principal has no disabled state and no key derives from a membership; workspace access additionally requires the directory's current membership on every request.
Resolution answers `KeyMissing`, `KeyUnrecognized`, `KeyRevoked`, checked before expiry, and `KeyExpired`, whose message states the expiry; each is 401 with `WWW-Authenticate: Bearer`, which adds `error="invalid_token"` when the request sent a key, and each message says how to replace the key; the scheme matches in any letter case.
The deployment holds no upstream credential whose failure a key's holder could see as unauthenticated.
A key resolves through its key cache shard, which a miss fills from the directory's `keyAccess`, the key and its principal in one transaction. A shard stores a resolved or revoked key and never an unknown token, and judges expiry by its own clock. Membership never comes from cached key data.
Revocation writes the shard's tombstone first, then revokes the directory's row, and a fill never overwrites a tombstone, so a revoked key fails at once whatever the shard held, and a revocation that fails after the tombstone still leaves the key refused.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
