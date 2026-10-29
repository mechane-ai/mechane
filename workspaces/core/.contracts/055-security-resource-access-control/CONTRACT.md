---
name: security-resource-access-control
message: Authorize every request on the server from current grants; logins, plain links, and caller-supplied facts grant nothing.
paths: ["packages/worker/*/src/**"]
---

## Rules

Authorize every request on the server against the principal's current account state, memberships, grants, and revocations.
Deny disabled, unverified, and revoked principals even when their credential is otherwise valid.

A successful login establishes a principal and grants no access; each service authorizes it against its own resources and grants.
A link, shared URL, or reference inside content grants no access by itself to the resource it points to.
Caller-supplied attribution, context, selection identifiers, or capability flags never grant access or prove a relationship between records.
Never derive authority from user-editable or descriptive data such as display names, contact emails, titles, or directory teams.
Grant access through a capability, such as a sharing code, only after validating its stored record, and take its owner and authority from that record, never from values supplied beside it.
Consume a single-use capability atomically with the action it authorizes.

Keep one authoritative grant model per resource kind; do not keep parallel access flags that can disagree with it.
Never let a grant on one resource or scope widen access to another.
Keep the authority to administer grants separate from the authority to read or change the resources they cover.
Give each credential type an explicit capability ceiling; a programmatic credential gains administrative or bypass powers only through an explicit grant.
Authorize a delegated request only when both the human subject and the acting service hold the required grants.
When acting on another principal's behalf, resolve access from that principal's current grants, never the operator's.
Give new resources and migrated records only explicitly declared grants.
Records attached to a private resource inherit its audience, and removing a reader removes access to its history and attachments.

Apply access scope before lookup, search, counting, and pagination, so results and totals never reflect records the principal cannot read.
Check authorization and apply the write it guards atomically, such as in one transaction or one scoped statement.
Resolve a name selector to exactly one permitted resource, or fail and ask the caller to disambiguate.
Never fall back to a more privileged credential or another principal after a denial.
Keep authorization decisions out of shared caches, and never serve a principal-specific response from a cache shared across principals.

Answer a missing or invalid credential as unauthenticated, such as HTTP 401.
Answer a request for a resource the principal may not know exists as not found, such as HTTP 404, with the identical status and body for missing, unpublished, and foreign-owned resources.
Answer forbidden, such as HTTP 403, only when the principal may already know the resource exists, such as a visible resource it may read but not change.
Record administrative grant changes with principal, credential, and target identifiers, excluding secrets.

## Checks

Exercise each changed operation with no credential, an invalid credential, a disabled principal, a principal without the grant, and another owner's principal, and compare statuses and bodies.
Revoke a grant or membership and confirm the next request is denied without a restart or cache expiry.
Does any access decision read login state, a link, an attribution field, a client-supplied capability flag, or user-editable profile data?
Compare the responses for a missing resource and another owner's private resource; can a principal tell them apart?
Check that search results, listing totals, and pagination exclude records the principal cannot read.
Present a capability with a substituted owner, and a single-use capability a second time, and confirm both are refused.
Review administrative, delegated, and service paths for access they inherit without an explicit grant.

## Local adaptations

Each principal operation resolves its caller from its key on every request, through the key's cache shard, and reads or changes only that principal's records: its keys, and the workspaces it is a member of.
A first approval by a provider-qualified identity creates a principal and one personal workspace whose owner membership is its initial grant. Local bootstrap uses its own identity provider and receives no special API bypass.
Revoking another principal's key or a missing one answers `KeyNotFound` with the same status and body, and the statement that revokes checks the owner itself.
Each member operation decodes the workspace's id from its path before its input, resolves the key through its cache shard, and checks `workspaceMembership` against the directory's current grants. A removed membership takes effect even when the key is cached; an unavailable directory fails closed. A non-member gets `WorkspaceNotFound`, as for a workspace that does not exist.
The Worker reaches a mech only through the admitted workspace's id, by `mechObjectName`, so a mech is never found through another workspace; any member lists a mech's saved memories, threads and drones, reads a drone, cancels its turns and its drones, and an interrupt item cancels as its sender.
Only a mech's own object calls its sandbox, by the same name, and each of its drones' sandboxes, by that name with the drone's id below it, so two mechs of one workspace, or a mech and its drone, never share a sandbox, and no operation reaches a sandbox directly; ast-grep `sandbox-stub-outside-mech` rejects a call of `sandboxStub` outside `packages/worker/mech/src`.
A drone's conversation selects neither the threads extension nor the memory tools that change memory or the context, so a drone reads its mech's memory as saved when it started and cannot change it, start a drone or reset itself; the mech resolves a conversation's role from the session id it bound, never from the model's text.
A guest answers only requests that name its own machine's id, 122 random bits that only the sandbox's object holds, so a caller that reaches a port celld publishes cannot drive it; a host machine's guest listens on loopback, and the host launcher answers only the stack's own Worker.
Workspace membership and its role are live directory authority. Key caches hold credential validity and principal identity, never a membership grant. Operations that manage workspace integrations separately require the current owner role.
Any member forks a mech of the admitted workspace, and the fork is a mech of that workspace whose creator is the member; the parent reaches the new mech's object only by `mechObjectName` under its own workspace's id, and only a mech's own object sends it a copy, whose begin deletes the object's database; ast-grep `copy-outside-forks` rejects a call of `receiveCopy` outside `packages/worker/mech/src/forks`.
Every request but `/health` counts against its address's `address` policy when Cloudflare names the address in `cf-connecting-ip`, an IPv6 address by its /64; `startDeviceApproval` also counts against `device_start`, an admitted caller against `principal`, shared by all of its principal's keys, and the device form against `code_attempt` for its provider-qualified identity. A limited request answers `RateLimited` with `retry-after` and logs `request.limited`; celld names no address, so locally only the principal and code policies apply.
A member operation of a suspended workspace answers `WorkspaceSuspended` once membership is checked, and the workspace's dispatches reserve against an allowance of 0, so its queued work ends `allowance_exhausted` unsent. Only a listed workspace that is not suspended starts a machine, and at most `MECHANE_WORKSPACE_MACHINES` of its sandboxes hold a lease at once; the bash tool reports any other ask as refused, and the refusal is logged as `sandbox.refused`.
Cloudflare containers start with direct internet disabled and route HTTP and HTTPS through `EgressGateway`. It admits only the shared package-source host list, refuses invalid or disagreeing URL and Host authorities, literal addresses and the deployment host, and forwards over TLS without following redirects. An interceptor setup failure starts no machine; other outbound ports remain closed.
The optional Tensorlake provider uses the same package-source host list and denies private IPv4 ranges. Its project credential never enters the guest. The local celld fence refuses the node and every private, shared and link-local range; it does not impose the hosted package-host list. Cloud deployment validation refuses the local fence setting, which also requires a loopback origin in Worker settings.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `copy-outside-forks` (055): enforced
- ast-grep `sandbox-stub-outside-mech` (055): enforced

<!-- End of the generated block. -->
