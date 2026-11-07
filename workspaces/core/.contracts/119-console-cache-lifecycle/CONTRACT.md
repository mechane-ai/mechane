---
name: console-cache-lifecycle
message: Admit protected browser copies through the server and keep required persistence within one owned cache lifecycle.
paths: ["packages/browser/console-cache/**", "packages/browser/console-data/**", "packages/browser/console/src/**"]
---

## Rules

Treat the browser database as a replaceable copy of server records. Resolve the current principal and workspace
membership through the server before opening a protected persisted view for each data runtime. Workspace returns,
cache recovery, and Back/Forward cache restoration pass that same admission gate. A retained application session or
cached membership cannot grant fresh admission. Rejected or inconclusive admission exposes no protected copy.

Require native wa-sqlite persistence. Missing browser capabilities, denied storage, or failed initialization produce an
actionable error. Retry the same backend after fresh admission; do not select memory storage or another database.
Keep these responsibilities separate:

| Owner | Responsibility |
| --- | --- |
| TanStack Query in `console-data` | Each tab's demanded requests, polling, focus refresh, cancellation, errors, and retry. |
| TanStack DB in `console-data` | Validated canonical records and exact ordered page receipts. |
| Native browser persistence in `console-cache` | Worker, SQLite transactions, and cross-tab collection replication. |
| Cache lifecycle in `console-cache/src/store/storage.ts` | Scoped generations, retention, recovery, and cleanup. |

Use published APIs without dependency patches, private imports, a custom Worker bridge, or a second record replication
protocol. Console presentation imports neither the cache nor its persistence libraries. Native Query results are
completion scalars; record values and page coverage have one owner in the canonical collections.

Persist records in their schema-owned serializable form. Validate restored rows and page receipts as well as new writes.
Publish a receipt only after the native persistence API confirms its referenced canonical updates. A page is ready only
when its exact receipt and compatible referenced rows are present; an absent receipt never means an empty page.
Keep refresh timing in the tab's Query state. A persisted receipt describes ordered membership and pagination, so an
unchanged successful read must not manufacture a durable mutation just to record when the request completed.
Keep credentials, drafts, unsent commands, and submission state outside this cache. A format change replaces derived
copies without deleting authoritative server data or application drafts.

Admit canonical writes through one short native Web Lock per generation in `console-data/src/collections.ts`.
Under that lock, reload the touched tables through the public `forceReloadSubset({})`, evaluate domain guards against
the current rows, construct the mutation, and await native acceptance. Use this boundary for fetched records,
acknowledged command reconciliation, receipts, and purges. Keep HTTP waits outside the generation's write lock.
Failed native acceptance or an uncertain write fences and retires its generation before releasing the lock; never
replay that write.
These locks order application decisions. Native TanStack remains the sole record replication owner, with no added queue
or cross-tab RPC protocol.

Scope cache identity to the installation, principal, workspace, and format generation. Keep the current generation's
validated pointer in browser storage and change it under the scope's exclusive Web Lock. Give each generation a fresh
random 128-bit identity and its own OPFS directory. Keep rendered paths within the native VFS limit, including journal
suffixes. Never discover a usable generation by scanning old files.
Each open runtime holds a shared lifecycle lease for its generation. This lease only prevents physical deletion while
a Worker can use that directory; it does not order record updates.

Retire the durable pointer before replacing or deleting a failed generation. Notify and fence active peers so a retired
owner cannot accept new work or publish later completions. Delete only a retired generation for which an exclusive
lifecycle lease is immediately available. A delayed close or blocked deletion leaves a quarantined directory, never a
reusable cache. A failed metadata write is a visible storage failure, not permission to reuse a retired owner.

Unauthenticated or forbidden reads end the admitted scope and retire its generation. Confirmed removal fences affected
local reads and retained results before purging their canonical rows and receipts. Broadcast validated scope or resource
invalidation; each active peer fences its affected reads when it receives the notification, before its own purge.
The admission channel carries no records and has no peer-acknowledgment barrier.
Sign-out invalidates the active scope and active same-principal tabs. Inactive workspace files still require fresh
admission and obey retention; sign-out need not enumerate every closed workspace. Transient read failures may retain
the same admitted owner's last authorized result under contract 113.

Reuse a generation for at most 24 hours, enforcing expiry during open and active use. Limit its main SQLite database
to 64 MiB with the native page-count limit and validate the resulting page size and cap. This is not a bound on transient
journal bytes or the browser's total storage. Reject an oversized existing database before exposing it.
Canonical tables may restore retained local rows eagerly within this policy; server history is still read on demand.

Bound application waits for opening, persistent updates, and cleanup. The native opener owns startup cancellation;
its established database exposes graceful close but no forced-termination API. Keep a retiring generation's lease until
native close settles or page suspension terminates its Worker. A timeout fences the runtime and leaves its generation
unavailable for reuse. Do not retry an uncertain write or create an automatic loop of replacement Workers.
For ordinary disposal, clean up native collections and their coordinator before closing the database. A terminal native
fault or timeout first fences the application owner, then promptly closes native resources; recovery cleans up the
remaining collections. Successful ordinary disposal may retain the generation. Reject completions from disposed owners.
Report failures independently of acknowledged server commands, which keep their result and request ID.

## Checks

Run the generated dependency boundaries and browser typecheck. Confirm that only the cache lifecycle composes native
browser persistence and that no product module imports the raw wa-sqlite driver. Inspect the required persistence type,
recovery path, and native API calls for memory branches, dependency patches, private entry points, or duplicate owners.

In a real browser against the packaged service, initialize all canonical tables concurrently, then reopen populated and
successful-empty pages while holding their network reads. Confirm exact receipt coverage reveals cached content.
Repeat with rejected admission, a principal or workspace switch, and an incompatible cache format. No protected content
may cross owners. Verify current-page reads and retained drafts after Back/Forward cache restoration.

Use two tabs for one generation. Check shared records and receipts, independent network error and retry state, polling,
command invalidation, and continued use after either tab closes. Release an older response after another tab accepts a
newer revision or terminal run state. Confirm canonical values do not regress and missing rows cannot become false empties.
Repeat with a stale prepared mutation, overlapping unversioned snapshots, a purge, and a persistence failure while
another writer waits. Confirm guards run after the latest persisted rows load and an uncertain writer retires its
generation before admitting the next writer. Reopen the database to verify the accepted results persisted.

Exercise expiry, the page-count cap, denied storage, failed open, rejected persistence, and interrupted cleanup.
Race retirement with another tab's open. Confirm peers stop accepting work, the retired generation is never selected again, and
an active generation cannot be physically removed. Verify that cleanup failures remain visible and retries stay bounded.

Fail a refresh and persistence separately after a server acknowledgement. Confirm that the command stays acknowledged,
its controls do not repeat it, and persistent recovery retains a later draft and uncertain request identity.
Replace the data runtime while ready views remain mounted; check page membership, focus, scroll, and native observer
cleanup. Temporary qualification probes stay outside tracked source under the existing test-curation contract.

## Local adaptations

Native async error handling is confined to `console-cache/src/store/storage.ts`. Its catches own storage health,
retirement, and cleanup. They neither run Effects nor hide failed server commands. Contract 046 permits forwarding the
native database's unchanged SQL and parameters solely for lifecycle checks. That guard retires only its own lifecycle
failures; native SQL errors remain intact for the adapter to handle. There is no cache type-assertion exception.

The release supplies the required browser headers and the same verified browser Worker and WASM inventory locally and in
production. An unavailable browser capability is an error; it does not activate another storage implementation.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `console-cache-persistence-owner` (119): enforced: Keep native persistence composition in the cache lifecycle, such as `console-cache/src/store/storage.ts`
- dependency-cruiser `console-cache-native-worker` (119): enforced: Use the native persistence API, such as `openBrowserWASQLiteOPFSDatabase`, instead of the raw wa-sqlite driver

<!-- End of the generated block. -->
