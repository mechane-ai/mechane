# @mechane/wrangler

Worker compiler options and verified build metadata shared by local development and release assembly.

Layer 4 · node lane · effect dialect · consumers: distribution, stack

`mise run build:server` builds the application Worker and Console, then records their release identity, format locks,
configuration, and inventory under `packages/worker/server/.output`. The release packager verifies those bytes before
using them. Rebuild after changing source or configuration; immutable artifact mode never rebuilds.

`readBuiltRelease()` supplies verified metadata. `workerBuildOptions()` gives the release compiler and local source
watcher the same target, export conditions, and compatibility bridge. The canonical deployment builders own bindings,
classes, migrations, and asset settings. Local application edits restart only their host and preserve the environment.
