---
name: console-cache-lifecycle
message: Admit protected browser copies through the server and keep persistence failures within one owned cache lifecycle.
paths: ["packages/browser/console-cache/**", "packages/browser/console-data/**", "packages/browser/console/src/**"]
---

## Rules

Treat the browser database as a replaceable copy of server records. Resolve the current principal and workspace
membership through the server for every new data runtime, before opening its protected persisted view. This includes
returning to a workspace and replacing the runtime through Continue online. A previously admitted application session,
cached membership, or cached records never grant fresh admission. An inconclusive admission cannot restore a protected
copy. The public entry and rejected admission show no protected copy.

Scope cache identity to the installation, principal, workspace, and format generation. Keep the database filename and
its Web Lock name with their owner in `console-cache/src/store`. Reject completions from a disposed owner.
On access denial or confirmed removal, clear affected memory and invalidate the active owner's known-denied persisted
copy before reuse. A failed purge never authorizes showing that record again. Sign-out disposes the active workspace
and invalidates active same-principal tabs. Previously closed workspace files remain subject to retention and fresh
server admission when reopened; sign-out does not require enumerating or physically erasing every inactive workspace
file. A transient read failure may retain the same admitted owner's last authorized result, as contract 113 permits.

Persist validated server records in their schema-owned serializable representation and the page metadata needed to
interpret their coverage. Protocol codecs restore runtime values after decoding; raw Effect objects are not a stored
format. Keep credentials, drafts, unsent commands, and application submission state out of this cache. Advance the
cache format generation to replace incompatible derived data. This does not authorize deleting authoritative server
data or the application's drafts.

Use the published TanStack collection, query, and persistence APIs without dependency patches or private imports.
`console-data` owns native collection composition and authoritative record updates. `console-cache` supplies the public
SQLite persistence driver through its dedicated module Worker. Worker messages carry driver operations, not a second
record synchronization, retry, or replication protocol. Console presentation imports neither the cache nor its native
persistence library.

Only the tab holding an exclusive Web Lock for the actual database file may start its file-owning Worker.
Keep that lock until the Worker has terminated. Other tabs, unsupported browsers, and failed cache initialization use
the same native collection model in memory without opening the file. They do not wait indefinitely for storage.
Each scope's cache file is reusable for at most 24 hours and up to 64 MiB. Enforce age and size when opening it and
while it is active; an expired or oversized file must be discarded before reuse. Canonical tables may restore their
retained local rows eagerly within this file policy. This does not authorize downloading an entire server history.

Give initialization, driver requests, and disposal explicit bounded lifetimes. A failed or hung open terminates the
owning Worker, which releases its nested file handles. Disposal attempts graceful close and always terminates that
Worker. Settle outstanding requests when it fails or terminates, and reject new requests after disposal.
A timed-out operation invalidates its connection; it does not silently retry a write whose outcome is unknown.
Retain the current file lease through the bounded attempt to invalidate a failed cache. A failed graceful close
upgrades that disposal to invalidation before releasing its lease. Successful ordinary disposal may retain the file.

Keep Turso imports and raw connection, statement, and transaction handles inside `store/worker/main.ts`.
The native SQLite driver's transaction callback uses one scoped transaction across its reads and writes.
Serialize complete connection operations, including statement preparation. A transaction holds that connection order
through its callback and commit or rollback, while its scoped operations use their own order. Bound queue waiting as
part of the operation lifetime and reject queued calls when the connection terminates.
Decode Worker request and response envelopes at their boundaries. Keep SQL forwarding inside this store under
contract 046, and keep the driver's required generic row assertion at the one site contract 017 names.
Validate restored canonical rows and page receipts before admitting them to native collections. Their schemas apply
to disk hydration as well as server-driven writes; a type declaration alone does not validate persisted data.

Complete a persisted canonical update only when the native persistence API confirms it.
Report a rejected local update as cache degradation; do not report an unconfirmed disk write as settled.
Replace or disable the failed cache without changing an acknowledged server command, its request identity, or a draft.
The application owns those lifetimes independently of the replaceable data runtime.

## Checks

Type-check the public driver interface and run the generated package boundaries. Confirm that only the cache Worker
imports Turso, only cache and data import persistence-core, and only data consumes the cache package.
Inspect native API calls for dependency patches, private entry points, and a second collection or synchronization engine.

In a real browser against the packaged Worker, reopen an admitted cache and then repeat with rejected admission.
Switch principal and workspace while a read is pending. Confirm that protected content never crosses those owners.
Warm one workspace, switch away, revoke its membership, then return while holding its first data read. Confirm that
fresh admission rejects the workspace before its cached content appears. Repeat admission failure during Continue online.
Exercise an incompatible cache generation, a transient read failure, a confirmed removal, and a failed cache write.
Initialize all canonical collections and query receipts concurrently against a cold cache, then reopen it. Confirm
that schema preparation and the first authorized reads finish within their operation deadlines.

Open two tabs for one file and confirm that only its lock holder opens it while both can use the Console.
Fail and hang an open, dispose the owner, and verify that a fresh Worker can acquire and use the file afterward.
Exercise transaction commit and rollback through the Worker bridge. Terminate it with a request pending and confirm
that the request settles and no later request enters that connection.
Race another tab's open with failed-cache cleanup and a failed graceful close. Confirm that invalidation holds the
existing lease through its bounded cleanup attempt and that failures remain visible.

After a server acknowledgement, fail persistence and refresh separately. Confirm that the command remains acknowledged,
its controls do not repeat it, and runtime replacement preserves a later draft and any uncertain request identity.
Continue online while ready views stay mounted. Confirm that native query observers bind the replacement client
without a collection-identity collision, and that draft text, page membership, focus, and scroll position survive.
Keep temporary qualification probes outside tracked source. The existing test-curation contract governs retained checks.

## Local adaptations

The cache uses native async error handling at exactly `src/store/storage.ts`, `src/store/connection.ts`, and
`src/store/worker/main.ts`. Their catches own cache health, RPC failure, and cleanup. They do not run Effects or hide a
failed server command. `src/store/protocol.ts` receives no error-handling or type-assertion exemption.

The release supplies the cross-origin isolation headers and the same verified WASM inventory to celld and Cloudflare.
An unavailable browser capability selects memory operation; it does not load a different database implementation.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `console-cache-worker-driver` (119): enforced: Open Turso only in the cache Worker, such as `packages/browser/console-cache/src/store/worker/main.ts`

<!-- End of the generated block. -->
