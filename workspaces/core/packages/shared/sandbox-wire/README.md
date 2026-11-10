# @mechane/sandbox-wire

The authenticated compute-service protocol, the guest and host-launcher protocols, and filesystem checkpoint metadata.

Layer 1 · shared lane · data dialect · any consumer

## Surface

- Service: `SandboxExecutionSubmission`, `SandboxExecutionResult`, and `sandboxExecutionPath` support durable command
  submission, credential-free observation, and cancellation. `SandboxExecutionResume` supplies fresh credentials to an
  existing intent after a cold start or restoration. Maintenance schemas are also re-exported by the product API.
- Capacity: `SandboxCapacityRequest` and `SandboxCapacityResult` authenticate the compute service's acquire/release
  callback at `SANDBOX_CAPACITY_PATH`. A reservation binds one workspace, mech, generation, and machine; refusal
  distinguishes current policy, workspace capacity, and a stale generation.

- Paths: `guestExecutionPath`, `guestHealthPath`, `guestWorkspacePath` and `launcherMachinePath`, over the segments of
  `GuestSegment`.
- Guest wire: `ExecutionRequest`, `ExecutionReceipt`, `ExecutionWait`, `ExecutionId`, `GuestStart` and `GuestListening`.
  Startup may carry a bounded public certificate-authority PEM bundle from trusted installation composition; executions
  cannot supply that trust configuration.
- Host launcher wire: `HostMachine`, `HostMachineStart` and `HostMachineStatus`.
- Progress: `ExecutionProgress`, `SettledReceipt` and `RunExecutionInput`; PersistenceFailed exposes a failed save and
  its known command outcome without claiming durability or automatically rerunning the command.
- Environment: `SandboxReport` separates committed files, checkpoint progress, and retained recovery state.
  `SandboxStopReceipt` names the retirement phase, last error, and closed recovery action; acceptance is not completion.
- Bounds: `GUEST_PORT`, `GUEST_VARIABLES`, `EXECUTION_VARIABLES`, `OUTPUT_TAIL_BYTES` and the execution spans.

## Use

Build a guest's or the launcher's path with its builder, which is the one place its layout is written. The guest parses
the same segments.

## Never

Write a guest path as a template outside its builder, or import anything but `@mechane/records`.
