# @mechane/testing

The smoke's helpers: fresh accounts, device approvals through a person's browser, runs of the built CLI, mechs that talk
to the scripted upstream, secret scans and the smoke's outcome.

Layer 5 · node lane · effect dialect · consumers: smoke

## Public surface

`src/index.ts` names every helper a scenario calls, the failures a scenario stops with (`ScenarioFailure`), and the
closed sets a scenario's own failure names: `FileStep` and `BrowserStep`.

## Layout

One folder per helper family, one helper per file:

- `src/accounts/`: a fresh account, and the token of its saved login.
- `src/approvals/`: a CLI run through a device approval, a signed-in account and a created key.
- `src/browser/`: a person's browser signed in at the local GitHub, and a client without a session.
- `src/cli/`: runs of the built CLI, to their exit or while they stream.
- `src/mechs/`: talking mechs, their turns and commands, and a gate a command waits at.
- `src/mechs/events/`: a follower of a mech's events and its waits.
- `src/sentinels/`: private files, and the texts a secret must not appear in.
- `src/worker-log/`: the Worker's lines of the stack's log.
- `src/outcomes/`: the smoke's one message table, and the status it ends with.
- `src/check.ts`: a named check, which writes `ok` or `not ok`.
- `src/fresh-folder.ts`: a fresh folder in the stack's state folder, which a failed run keeps.

## Never

- Never mock Mechane's code: every helper drives the built CLI, the stack's Worker or its local services.
- Never write a secret into a failure: a scan names the text that holds one, never the secret.
