import { GUEST_PORT } from '@mechane/sandbox-wire';

/** Where a container's guest listens when its start names no host or port: every interface, on the image's port. */
export const CONTAINER_DEFAULTS = { host: '0.0.0.0', port: String(GUEST_PORT) } as const;
