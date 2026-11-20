# @mechane/agent-slot

Strict per-agent serialized execution slot Durable Object (`AgentSlotObject`).

Owns the single execution lease, monotonic fencing epoch, FIFO session wait queue, 45-second lease alarm expiry,
15-second heartbeat renewal, and non-blocking session wake notifications without touching `pi-durable`, model providers,
or Postgres control storage.
