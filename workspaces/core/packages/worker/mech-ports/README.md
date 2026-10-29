# @mechane/mech-ports

The mech Durable Object's ports to its harness but its hands: its dispatch meter, and its memory and threads.

Layer 4 · worker · plain · consumers: `@mechane/mech`

## Layout

- `meter/`: the dispatch meter: a dispatch's bound, its reservation in the workspace's ledger and against the mech's
  cap, its refusal, its settlement at the usage the upstream reported, and the drain that holds new dispatches.
- `memories/`: the memory port: the reads of the running turn's memory, and the decisions of its writes, changes and
  deletions.
- `threads/`: the threads port: the decisions of an opened or updated thread and of a drone's start.

## Use

- `dispatchMeter` and `drainableMeter` build the `MechMeter` every dispatch of a mech and its drones passes before it
  leaves the object.
- `mechMemory` and `mechThreads` build the ports `@mechane/harness-tools` calls.
- Each tool call decides in one transaction, and a task that recorded its answer answers the same after a restart.

## Never

- Never let a dispatch reach the upstream before its reservation is granted.
- Never record a refused memory change: a refusal records nothing, so pi's rerun decides it again.
- Never let a drone read memory saved after its start: its reads stop at the version its start recorded.
