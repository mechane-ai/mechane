# @mechane/console-data

The browser data owner for an admitted origin, principal, and workspace. It exposes native TanStack DB collections,
fixed read descriptors, and named API commands. Public Console messages load through the typed conversation API and
remain outside canonical domain collections. Query owns their demanded reads; the Console retains the accumulated
transcript, route state, and drafts. Private model output is available only through activation inspection.

Call `createConsoleData` with the expected principal, workspace, current route's `initialRequests`, and an
`AbortSignal`. Every runtime confirms the principal and workspace membership through the server before opening
persistent storage, including workspace switches and recovery. Storage failure rejects startup; there is no memory mode.

Each tab's TanStack Query observers own network demand, polling, focus refresh, errors, and retries. Their results are
completion timestamps. Validated server records and exact read receipts live only in the canonical TanStack DB
collections, whose native coordinator shares committed data across tabs. Receipt publication waits for its canonical
rows to settle. Receipts preserve ordered page membership and pagination metadata, including successful empty results.
`ready(request)` checks the receipt and every referenced row, so cached content does not wait for a network refresh.
`read-ready.ts` declares table dependencies and cardinality once per read kind. Hydration and coverage use the same
declaration; detail-specific compatibility remains explicit. Add a new read there alongside its request and ingestion.

`diagnostics` reports aggregate native network counts without exposing request keys or record contents. Console Settings
combines those counts with existing storage health. It does not create requests or become another status authority.

`subscribeReadStatus(readId, listener)` owns an observer while that read is visible. Multiple readers share it, and the
last unsubscribe releases it. Native query invalidation refreshes active reads after commands. Protocol codecs restore
dates and optional fields from the canonical records' encoded values.

An exact read holds a generation-scoped Web Lock from its HTTP request through receipt publication. Different reads can
fetch concurrently. A separate write lock reloads the touched native tables before preparing each guarded mutation and
waits for durable acceptance. Commands and purges use that same writer. Queue waiting and admitted writes are bounded;
an uncertain native write retires the generation before releasing its lease. These locks own application admission,
while the native coordinator continues to own database writes and record replication.

Commands settle from the server acknowledgement. Local reconciliation and refresh report their own health without
turning an acknowledged command into an uncertain result. Unauthenticated or forbidden reads end the admitted scope and
retire its generation. Confirmed removal fences local reads before purging affected records and receipts. Peers fence
their reads on receiving the invalidation notification, before their own purge; there is no peer-acknowledgment barrier.
This admission channel carries no records. Native TanStack persistence owns record replication, and cache generation
retirement hides the old runtime's protected view.

Dispose the runtime when its scope unmounts. Cleanup cancels network observers, waits within its budget for native
writes and collections, and closes the owned cache. `clearScope()` hides data and requests bounded invalidation before
sign-out. After a local failure, `recover(currentRequests)` retires the old generation and creates a freshly admitted
persistent runtime. Failed retirement rejects recovery. Drafts, navigation, and command identities remain with the
Console throughout.

The [console boundaries](../../../.contracts/113-console-boundaries/CONTRACT.md) and
[cache lifecycle](../../../.contracts/119-console-cache-lifecycle/CONTRACT.md) contracts define persistence, membership,
and cleanup guarantees.

Evidence list and artifact reads keep their metadata in `evidenceArtifacts` with exact read receipts. Media bytes are
read separately through the authenticated content route; they do not enter the browser's canonical record cache. Pending
and failed captures remain records, and only ready artifacts have readable media. A confirmed missing artifact fences
its detail and the mech’s capture-page reads before removing the canonical row and page receipts. Peers receive the
artifact identity and perform the same invalidation; explicit retry waits for the purge.

Passive environment overviews use `environments`, keyed by mech. One read includes the recorded saved checkpoint,
pending transfer, recovery evidence, and bounded active and recent process summaries. A saved checkpoint describes
captured files, not every later write; command completion does not establish a save. Bounded logs use
`environmentProcessDetails` and are fetched only for opened handles. Stop commands target the recorded machine and
refresh its overview and detail reads; a stale handle cannot stop a replacement machine.

## Extending the Console

Use the [screen guide](../../../docs/console.md#adding-a-screen-or-feature) for the data ownership decision and
implementation path. Every new ordinary resource, report, and picker uses the same records, receipt, and live-read
owners. Fresh admission and public conversation history are explicit protocol exceptions, not alternate general-purpose
data APIs.
