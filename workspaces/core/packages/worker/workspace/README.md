# @mechane/workspace

The workspace Durable Object and its decisions.

Layer 4 · worker · plain · consumers: `@mechane/app`

## Layout

- `credentials/`: atomic writes of encrypted credentials that preserve existing values during imports.
- `dispatches/`: a dispatch's reservation against the workspace's day allowance and its mech's cap.
- `leases/`: the machine leases that hold the workspace's sandboxes to its machine quota.
- `policy/`: saved workspace controls combined with installation ceilings.
- `slack/`: admission of signed events through stored installations and channel bindings.

## Use

- `WorkspaceObject` owns one workspace's mech index, dispatch ledger, machine leases, policy, encrypted credentials and
  Slack records. The Worker and the workspace's mechs call it by RPC.
- `reserveDispatch` reserves a dispatch's cost or refuses it before any model call; `settleDispatch` records what it
  spent.
- `leaseMachine` grants a sandbox a machine while fewer than the quota run, and `releaseMachine` returns it.
- Policy changes take effect for new reservations and leases without restarting agents. The installation's ceilings
  still bound those decisions.

## Never

- Never let a dispatch spend before its reservation commits.
- Never make an outbound call: each method decides and writes synchronously.
