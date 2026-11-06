# @mechane/console-data

The browser data owner for an admitted origin, principal, and workspace. It exposes typed native TanStack DB
collections, fixed read descriptors, and named API commands. The Console owns React queries, route state, and drafts.

Call `createConsoleData` with the expected principal, workspace, current route's `initialRequests`, and an
`AbortSignal`. Each runtime confirms the current principal and workspace membership through the server before opening
local storage, including workspace switches and recovery. Required API reads start concurrently and wait for that
admission before ingestion. Canonical records retain the protocol's encoded values; decoding restores dates and optional
fields for existing views. An exact read receipt holds ordered keys and pagination metadata, including successful empty
results. `ready(request)` waits for that receipt and every referenced row.

Commands settle from the server acknowledgment. Local reconciliation and targeted refresh report their own health
without turning an acknowledged command into an uncertain result. Confirmed denial or removal hides the affected records
and fences late writes. Cached records never establish authorization.

Dispose the runtime when its scope unmounts. Cleanup cancels reads, settles native writes, and closes the owned cache.
`clearScope()` hides scope data and requests bounded cache invalidation before sign-out. After a local failure,
`continueOnline(currentRequests)` discards the failed cache and creates a fresh memory runtime; the Console retains
drafts and navigation outside that replacement.

The [console boundaries](../../../.contracts/113-console-boundaries/CONTRACT.md) and
[cache lifecycle](../../../.contracts/119-console-cache-lifecycle/CONTRACT.md) contracts define persistence, membership,
and cleanup guarantees.
