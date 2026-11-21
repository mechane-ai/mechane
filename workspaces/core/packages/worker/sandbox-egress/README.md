# @mechane/sandbox-egress

Cloudflare Worker egress gateway entrypoint (`EgressGateway`) for sandbox containers.

Enforces outbound destination allowlists, blocks private networks and installation aliases, and confines scoped Managed
Agents worker credentials strictly to canonical worker routes.
