# Console cache

This private package supplies required native TanStack browser SQLite persistence to `@mechane/console-data`. The caller
must admit the principal and workspace through the server before opening their cache. Stored records are replaceable
server copies; the cache contains no credentials, drafts, or unsent commands.

`openConsoleStorage` opens wa-sqlite in the upstream OPFS Worker and uses `BrowserCollectionCoordinator` for native
collection replication. Unsupported or unavailable storage rejects startup. There is no memory mode or alternate engine.
During ordinary disposal, the caller cleans up its collections before closing the cache. A terminal native fault first
fences the data runtime and promptly closes native resources; recovery cleans up the remaining collections.

Each installation, principal, workspace, and cache format has a durable generation pointer. Short Web Locks protect that
pointer; shared generation leases permit tabs to use one database. Native TanStack and wa-sqlite own transactions,
record replication, and file coordination. This package owns namespace retirement and browser lifetime only.

Retirement removes the pointer before any file cleanup. Every later open selects a fresh random generation, so failed
cleanup cannot restore an old cache. The invalidation callback immediately fences the owning data runtime. Other tabs
observe pointer changes, and each SQL operation checks its generation before and after completion. Old directories are
removed only while holding an exclusive generation lease. Shared native temporary files remain upstream-owned.

A generation expires after 24 hours. SQLite limits its main database to 64 MiB; transient journals and native temporary
files are outside that cap. The native driver serializes whole transactions. The lifecycle wrapper bounds application
waits without retrying SQL whose outcome is unknown. Native open supports cancellation; established connections expose
no force-termination API. A timed-out close quarantines the generation and retains its lease until close settles or the
native pagehide handler terminates its Worker.

`discard` rejects if durable retirement fails. Recovery must await it before opening another admitted runtime.
`discardConsoleStorage` retires a scope that admission rejected before a storage handle exists. Ordinary successful
`dispose` preserves the selected generation.

Build through [Console](../console/README.md). The native package supplies the Worker and WASM assets to the same
production bundle served locally and on Cloudflare.
