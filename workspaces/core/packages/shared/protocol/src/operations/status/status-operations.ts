import { health } from './health.ts';
import { readiness } from './readiness.ts';

/** Deployment liveness and readiness reports. */
export const STATUS_OPERATIONS = { health, readiness } as const;
