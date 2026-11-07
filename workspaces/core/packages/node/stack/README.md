# @mechane/stack

The local stack runs Mechane's built Node server with Postgres and the same Workflow engine as production. It copies the
server artifact outside the checkout before starting, so local dependency links cannot conceal an incomplete release.

Layer 5 · node lane · plain dialect · consumers: testing, smoke

## Develop

Install the repository's pinned tools and start Docker. After building the server, guest, and sandbox service, run
`mise run dev` for a disposable fixture. The launcher prints the console URL and `MECHANE_ORIGIN` for the CLI. The local
GitHub sign-in offers owner, member, and rejected outsider accounts. Scripted HTTP model replies require no provider
account and never call a paid model.

Fixture mode runs the real sandbox Worker in Miniflare and the real guest as a host process. That guest does not isolate
commands from the developer's machine. The smoke supplies synthetic commands. Configured mode requires an authenticated
sandbox service and does not use the process fixture.

`mise run start` retains state in `~/.local/state/mechane`, or `MECHANE_LOCAL_STATE_DIR`. Supply the server's
[runtime configuration](../runtime/src/config.ts) and [authentication settings](../server/src/settings/server.ts)
through the environment. The local launcher owns the Postgres connection, encryption keyring, and bootstrap workspace
identity. `MECHANE_LOCAL_ORIGIN` selects a loopback origin; its default is `http://127.0.0.1:8787`.

The launcher must run under pinned Node 24. An embedding runner can supply `nodeExecutable`; the launcher checks its
version before starting the server or guests. Neither source mode nor release mode silently selects another Node from
`PATH`.

## Lifecycle

`runStackProgram` owns startup, signals, and cleanup for both smoke and development. Its callback receives the local
stack and an interruption signal. The stack exposes its origin, provider fixtures, server log, and explicit `restart`
and `stop` operations. Restart replaces only the Node process. Postgres, provider gates, and sandbox executions remain
available, allowing checkers to verify recovery after a real process kill. `dumpStorage` reads the actual local database
for credential leak checks; its result must stay out of logs.

Miniflare runs in an owned child process so its signal handlers cannot bypass the launcher's cleanup. The host fixture
still shares the developer's operating system; container-level cleanup after abrupt guest death requires hosted
qualification.

Each stack records its owner and processes in a private state directory. Docker containers carry that ownership and a
review time. Stop removes disposable data and its own container; persistent mode retains database files and the keyring.
A failed startup stops its services but keeps private files for diagnosis. Remove that reported directory after
inspecting the failure. An existing ownership record prevents a second launcher from taking the state directory.

The public fixture and lifecycle types live in [types.ts](src/types.ts). Fixtures implement external HTTP protocols; all
Mechane operations still pass through its built server and actual stores.
