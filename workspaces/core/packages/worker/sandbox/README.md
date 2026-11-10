# @mechane/sandbox

One mech’s persistent developer environment and command receipts. The authenticated sandbox service calls its Durable
Object; the application runtime owns user authorization, execution grants, and budgets.

## Layout

- `capacity/`: owner binding and the intent to start or stop the object’s one machine.
- `executions/`: command admission, observation, cancellation, and receipts.
- `machines/` and `providers/`: machine creation, health, startup deadlines, and the guest transport.
- `checkpoints/` and `workspace/`: committed R2 generations, transfer, restoration, and retirement.
- `maintenance/`: explicit inspection, replacement, deletion, and cancellation.
- `egress/`: the Cloudflare gateway’s admitted HTTPS destinations.
- `service/`: the authenticated HTTP boundary shared by the application Worker and local environment entry.

## Execution

An execution ID names one command and timeout. Repeating it observes the same receipt; changing either input returns a
conflict. Observation carries no command or credentials. A missing guest after dispatch becomes `Uncertain`, and the
command never runs again automatically. Cancellation records its intent before stopping an active machine. An accepted
command that has not reached its guest can resume with fresh credentials under the same execution ID.

Commands run serially against the mech’s shared files. Before returning a settled receipt, the object saves `/home/node`
as independent R2 parts and commits the generation with the receipt. Replacement machines verify and restore the last
committed generation before running commands. A failed restore never becomes an empty workspace.

Upload and restoration advance existing archive parts in bounded sequential batches. Each part retains its durable
cursor and validation. Batch limits bound scheduling; only the complete checkpoint establishes saved files. New
generations publish an immutable manifest before the head and receipt commit. Restoration verifies its digest. Earlier
committed generations retain their original inline archive metadata and integrity checks.

`PersistenceFailed` retains the known command outcome, output, and live files for recovery. It keeps the previous
committed head intact. A later command can inspect or clean those files and retry the save. Losing that machine restores
the previous head.

Maintenance progresses through durable alarms even when its caller disconnects. Failed checkpoints and replacement
deadlines end maintenance without blocking recovery commands. Cancellation preserves the source and discards only an
uncommitted replacement.

Stop returns a durable operation receipt. Inspection reports its phase, last error, and recovery action separately from
the committed head, pending transfer, and recovery files. Repeated Stop attaches to the same operation until completion
or fresh recovery evidence. Completion requires confirmed shutdown; accepting Stop does not establish saved files.

## Limits

The guest pauses writers while archiving. Archives permit at most 2 GiB uncompressed and 512 MiB compressed, with a
five-minute operation deadline. Each command copies the full home; large repositories need workload qualification.
Generated caches belong outside the committed home.

Cloudflare containers have direct internet disabled. HTTP and HTTPS pass through `EgressGateway`, which validates
matching URL and Host authorities, admits configured public hosts, uses TLS, and follows no redirects. The local process
provider exercises the same guest protocol without claiming container isolation. Celld's real-container fixture selects
`MECHANE_SANDBOX_CONTAINER_NETWORK=direct` explicitly: it enables internet without gateway interception or its
certificate. That fixture qualifies container and checkpoint behavior, not hosted egress enforcement.

Trusted installation composition may set `MECHANE_SANDBOX_TRUSTED_CERTIFICATES_PEM` to a bounded public CA bundle for
guest HTTPS endpoints. The provider passes it only at guest startup. The guest combines it with public roots and the
gateway CA when present; model tools cannot select certificate trust.
