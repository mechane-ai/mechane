# @mechane/guest

The guest program every machine of a sandbox runs, which runs each execution once, and the container image that carries
it.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/`: the program: its settings, the server that answers each request in a fiber of its own, and its exit.
- `src/executions/`: the executions resource: its route, the ledger of every execution by id, one run of bash in a
  process group of its own, and the receipt with its output's tail.
- `src/workspace/`, `src/archives/` and `src/archive-files/`: asynchronous archive/restore jobs and bounded part IO.
- `src/quiescence/`: stops command-owned processes before a container workspace snapshot.
- `src/sources/`: trusted checkout, bounded change capture, and the request journal that holds each source lease.
- `image/`: the image's Dockerfile, which copies the bundle that `mise run build:guest` writes beside it.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The guest's wire, its paths and its variables are declared
once in `@mechane/sandbox-wire`, which the Worker's providers and the stack's host launcher read too.

## Use

`mise -C workspaces/core run build:guest` bundles `src/main.ts` into `image/guest.mjs`. The stack's host launcher runs
that bundle as a host machine, and the sandbox image runs it in a container. Its surface is its wire: a `GET` of
`/machines/<machine id>/health`, and a `PUT` of `/machines/<machine id>/executions/<execution id>` that answers the
execution's receipt. Workspace routes archive, transfer, restore and release a generation. The ledger freezes new
commands until release; a failed save can release the live workspace for a later cleanup command.

## Never

- Never restart a guest that has accepted an execution: its identity and receipt ledger remain single-use.
- Never read the environment outside `load-guest-settings.ts`, and never give an execution a variable beyond `PATH`, its
  home and the execution variables.

Container scope explicitly selects an isolated process namespace. Quiescence preserves the guest and its ancestor init
processes and stops other live processes of the guest user, including detached sessions. Failure to establish quiescence
fails the archive. Host fixtures explicitly select Process scope; it cannot authorize private repository credentials.
Archive scratch files stay outside the home being saved. Raw and compressed byte limits are enforced while streaming,
and restoration validates part sizes and the whole archive checksum before replacing home contents.

Private source credentials require a fresh container generation. The controller commits the old home, destroys its guest
and restores the snapshot before preparing a credential lease; quiescing a previously used guest alone cannot establish
this boundary. No agent command is admitted until revocation or confirmed token expiry.
