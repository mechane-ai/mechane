---
name: security-server-secret-storage
message: Encrypt held secrets bound to their record, keep keys outside the database, and never log secret values.
paths: ["packages/node/runtime/**", "packages/node/server/**", "packages/node/stack/**", "packages/worker/sandbox*/**", "infrastructure/**"]
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

Deployment secrets include database connections, GitHub OAuth, model access, the vault keyring, sandbox service
access, and generic notification-producer authentication. The installation's secret store supplies them privately. Logs and public
manifests hold references and safe correlation IDs only. Local development credentials stay in owner-only files.

Workspace vault records use AES-256-GCM with a fresh 96-bit nonce and key version. Associated data binds the purpose,
workspace, and credential reference. The keyring stays outside the database. Owner-only write operations and metadata
reads expose no credential-value API.

Workflow arguments, results, and model serialization contain references rather than resolved secrets. Trusted steps
resolve credentials immediately before use. The model adapter reconstructs its provider with live credentials inside
the request boundary. The complete serialized workflow state is part of credential-leak verification.

Command execution receives only its explicit current generic grant. Host infrastructure and notification-producer
secrets never become command credentials. Provider issuance and platform secrets belong to the configured application
service. Runtime-managed values never enter model context or checkpoints. Granted code can deliberately copy received
credentials, so authorization remains distinct from accidental-output redaction. Provider failures and tool results
contain no raw credential-bearing bodies.

The sandbox gateway injects no upstream account credential. Runtime and migration database connections remain separate;
the runtime receives only its domain and Workflow privileges. Upstream schema bootstrap belongs to the explicit
migration process. Application code does not edit upstream private tables or delete retained platform history.

The runtime may read its own migration ledger's version and checksum for startup compatibility and readiness. This
replaces the upstream check's blanket prohibition on reading migration state. Grant SELECT for that metadata only;
DDL and ledger writes remain exclusive to the migration credential. Use the existing ledger rather than copying its
values into a second runtime-information table. Verify that the runtime can read metadata but cannot alter the ledger.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
