# @mechane/sandbox

One mech’s persistent developer environment and command receipts. The authenticated sandbox service calls its Durable
Object; the Node runtime owns user authorization, execution grants, and budgets.

## Layout

- `capacity/`: owner binding and the intent to start or stop the object’s one machine.
- `executions/`: command admission, observation, cancellation, and receipts.
- `machines/` and `providers/`: machine creation, health, startup deadlines, and the guest transport.
- `checkpoints/` and `workspace/`: committed R2 generations, transfer, restoration, and retirement.
- `maintenance/`: explicit inspection, replacement, deletion, and cancellation.
- `egress/`: the Cloudflare gateway’s admitted HTTPS destinations.

## Execution

An execution ID names one command and timeout. Repeating it observes the same receipt; changing either input returns a
conflict. Observation carries no command or credentials. A missing guest after dispatch becomes `Uncertain`, and the
command never runs again automatically. Cancellation records its intent before stopping an active machine. An accepted
command that has not reached its guest can resume with fresh credentials under the same execution ID.

Commands run serially against the mech’s shared files. Before returning a settled receipt, the object saves `/home/node`
as independent R2 parts and commits the generation with the receipt. Replacement machines verify and restore the last
committed generation before running commands. A failed restore never becomes an empty workspace.

`PersistenceFailed` retains command output and the live files for recovery. It keeps the previous committed head intact.
A later command can inspect or clean those files and retry the save. Losing that machine restores the previous head.

Maintenance progresses through durable alarms even when its caller disconnects. Failed checkpoints and replacement
deadlines end maintenance without blocking recovery commands. Cancellation preserves the source and discards only an
uncommitted replacement.

## Limits

The guest stops command-owned processes before archiving. Archives permit at most 512 MiB uncompressed and 256 MiB
compressed, with a five-minute operation deadline. Each command copies the full home; large repositories need workload
qualification. Generated caches belong outside the committed home.

Cloudflare containers have direct internet disabled. HTTP and HTTPS pass through `EgressGateway`, which validates
matching URL and Host authorities, admits configured public hosts, uses TLS, and follows no redirects. The local process
provider exercises the same guest and checkpoint protocol without claiming container isolation.
