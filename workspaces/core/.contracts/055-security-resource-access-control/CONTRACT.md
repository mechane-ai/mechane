---
name: security-resource-access-control
message: Authorize every request on the server from current grants; logins, plain links, and caller-supplied facts grant nothing.
paths: ["packages/worker/runtime/**", "packages/worker/server/**", "packages/worker/control-store/**", "packages/worker/sandbox*/**"]
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

Server authentication resolves a current principal, then the operation checks current workspace membership and role.
All resource lookups are scoped by the admitted workspace. A missing resource and a foreign resource have the same
not-found response. Owner-only configuration and integration operations recheck ownership at their write boundary.

An admitted GitHub identity may receive the installation's explicit initial workspace membership. Login alone grants
no other workspace access. API keys and browser sessions do not cache membership authority. A removed membership or
revoked key fails on the next operation, including repeated reads and tool dispatch.

Each session has its own sandbox identity. Authenticate access to the sandbox service and bind a lease to its
installation, environment, session and work item. A guest receives only its session-scoped work credential.

Workspace policy gates new model reservations and compute admission atomically with their records. Suspended work
cannot acquire new paid work or credentials. Existing command effects remain observable; suspension never erases files.

The integration verifies its provider's events and owns external permissions, approval policy and receipts.
Managed Agents admission authenticates the application credential and resolves the session and creator independently
of body metadata. Authorize a tool result against the specific pending call. A submitted event cannot extend a grant.

The Cloudflare compute provider disables direct internet and routes HTTP through its declared egress gateway.
Invalid or disagreeing URL and Host authorities, literal private targets, and unsupported ports are refused. Local
compute fixtures remain explicitly isolated and cannot become a production fallback.

Refuse guest browser and general command egress to control-plane hosts and installation aliases. The trusted worker
transport uses the documented session-scoped work secret for specific session operations at the canonical origin.
Refuse to forward that credential to another origin, even when public web access is enabled. Keep environment polling
keys, shared application credentials and the server's credential manager outside the guest. Exercise wrong work IDs,
foreign session access, stale lease and rejected redirects through the same production entry points used locally.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
