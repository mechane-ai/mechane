# Mechane infrastructure

Operators deploy one Cloudflare application Worker with Mech and Sandbox Durable Objects, Console assets, a checkpoint
bucket, and a container application. Postgres owns shared control data. Each installation consumes qualified immutable
release bytes; infrastructure does not compile application code or seed runtime records.

- `modules/cloudflare/` declares application identity, bindings, domain routing, storage, and sandbox capacity.
- `provider/` verifies qualification, uploads Worker modules and assets, activates the version, and manages guest images
  and container rollout.
- `examples/cloudflare/` shows an extracted release module and provider setup.
- `check.sh` validates the module and provider without a cloud account.

The release ZIP includes the compiled Worker, Console, database migration and grant commands, historical import command,
notices, and installation metadata. Its candidate directory also contains a digest-bound artifact inventory,
qualification receipt, input files, and check evidence. Deployment verifies these bytes and never rebuilds them.

The installation owner supplies Postgres, non-secret settings, and Secrets Store references. Database migration
credentials belong only to the migration command. The application receives its restricted runtime database credential.
Public users need no private repository or Factory tooling.
