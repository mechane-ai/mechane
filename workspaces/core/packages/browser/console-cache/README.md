# Console cache

This private package supplies native TanStack SQLite persistence to `@mechane/console-data`. The server must admit the
principal and workspace before the caller opens their cache. The cache contains replaceable server copies; it grants no
access and stores no credentials, drafts, or unsent commands.

`openConsoleStorage` selects persistence or memory within 500 ms. Its input signal cancels startup only. After the
promise returns, the caller owns the selected storage and must clean up its native collections before calling `dispose`
or `discard`. `createMemoryStorage` supplies the explicit online-only replacement.

One tab holds a Web Lock for each origin, principal, workspace, and format. Other tabs use memory. The owner keeps its
lock until its database Worker terminates. `dispose` preserves the file. `discard` removes only that scope's database,
WAL, and creation stamp while holding the lock; a memory tab never removes another tab's file. Cleanup failures appear
in the stable health snapshot and do not reverse an acknowledged server command.

Fatal connection failures discard under the existing lock before releasing it, including a failure during graceful
close. Failed startup also attempts bounded invalidation before releasing its lock; the memory choice can return while
that cleanup finishes. Successful disposal continues to preserve the cache.

The driver serializes complete standalone SQL operations and transaction lifetimes, including statement preparation.
Calls inside a transaction use a separate sequence while that transaction retains the connection. The ten-second
operation deadline includes queue waiting, and connection termination rejects queued callers. This also keeps concurrent
collection initialization from overlapping schema operations on the same Turso connection.

`discardConsoleStorage` invalidates an earlier scope when admission fails before a storage handle exists. It has a fresh
three-second lifetime and returns whether removal completed. Deletion removes the validity stamp first, so a blocked
database deletion cannot make an old copy reusable.

The whole file expires after 24 hours. Database and WAL size are checked at open and after writes; crossing 64 MiB stops
persistence, and the next open replaces the file. There is no row eviction or cross-tab record replication.

Build this package through [Console](../console/README.md). Its dedicated module Worker imports the public Turso Vite
entry. Production must serve the emitted worker and WASM assets with cross-origin isolation headers. Browsers without
the required capabilities select memory without loading Turso.
