# @mechane/harness

The pi adapter: a mech's harness, conversations, prompt sections and metered models, behind Mechane-named ports.

Layer 3 · worker · plain · consumers: `@mechane/mech`

## Layout

- `database/`: the mech's one SQLite client, shared by pi's storage and the mech's store, so their transactions queue
  one behind the other.
- `drones/`: a drone's conversation: its opening, its brief and its abort.
- `models/`: the metered model API, which refuses a dispatch the allowance cannot cover before the upstream receives it.
- `progress/`: what pi has done with each inbox item and drone brief, read from its submissions and entries.
- `turns/`: a canceled or faulted turn's close, and the stop of the run that holds it.

## Use

- `openMechHarness` opens a mech's harness with the extensions `mechExtensions` builds. It answers `MechHarness`: the
  mech delivers items and briefs, opens and aborts drones, closes turns, reads progress, and lets pi work.
- `shareDatabase` gives pi and the mech's store the one client.
- `ItemEnded` and the progress types are what the mech records from a commit or a catch-up.

## Never

- Never import `@mechane/harness-tools`: the mech passes the tools in.
- Never let a pi type cross a port the mech reads.
- Never let a dispatch reach the model upstream before the meter reserves its allowance.
