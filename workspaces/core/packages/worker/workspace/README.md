# @mechane/workspace

The workspace Durable Object and its decisions.

Layer 4 · worker · plain · consumers: `@mechane/app`

## Layout

- `dispatches/`: a dispatch's reservation against the workspace's day allowance and its mech's cap.
- `leases/`: the machine leases that hold the workspace's sandboxes to its machine quota.

## Use

- `WorkspaceObject` holds one workspace's mech index, its dispatch ledger and its machine leases. The Worker and the
  workspace's mechs call it by RPC.
- `reserveDispatch` reserves a dispatch's cost or refuses it before any model call; `settleDispatch` records what it
  spent.
- `leaseMachine` grants a sandbox a machine while fewer than the quota run, and `releaseMachine` returns it.

## Never

- Never let a dispatch spend before its reservation commits.
- Never make an outbound call: each method decides and writes synchronously.
