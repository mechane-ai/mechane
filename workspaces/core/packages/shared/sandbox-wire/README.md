# @mechane/sandbox-wire

Every shape that crosses into or out of a sandbox: the guest wire, the host launcher's wire and an execution's progress.

Layer 1 · shared lane · data dialect · any consumer

## Surface

- Paths: `guestExecutionPath`, `guestHealthPath`, `guestWorkspacePath` and `launcherMachinePath`, over the segments of
  `GuestSegment`.
- Guest wire: `ExecutionRequest`, `ExecutionReceipt`, `ExecutionWait`, `ExecutionId`, `GuestStart` and `GuestListening`.
- Host launcher wire: `HostMachine`, `HostMachineStart` and `HostMachineStatus`.
- Progress: `ExecutionProgress`, `SettledReceipt` and `RunExecutionInput`; PersistenceFailed exposes a failed save
  without claiming durability or automatically rerunning the command.
- Bounds: `GUEST_PORT`, `GUEST_VARIABLES`, `EXECUTION_VARIABLES`, `OUTPUT_TAIL_BYTES` and the execution spans.

## Use

Build a guest's or the launcher's path with its builder, which is the one place its layout is written. The guest parses
the same segments.

## Never

Write a guest path as a template outside its builder, or import anything but `@mechane/records`.
