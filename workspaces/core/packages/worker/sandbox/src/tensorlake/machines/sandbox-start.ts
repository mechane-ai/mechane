import { MACHINE_LEASE } from '@mechane/rpc';
import { GUEST_PORT } from '@mechane/sandbox-wire';
import { Duration } from 'effect';
import type { TensorlakeSettings } from '../types.ts';

const TENSORLAKE_PENDING_SECONDS = 90;
const TENSORLAKE_MEMORY_MIB = 1024;

const TENSORLAKE_ALLOWED_HOSTS = [
  'github.com',
  '*.githubusercontent.com',
  'api.github.com',
  'registry.npmjs.org',
  'pypi.org',
  'files.pythonhosted.org',
] as const;

const TENSORLAKE_DENIED_NETWORKS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
] as const;

/** Starts a private guest with package-source egress and an idle suspension timeout, carrying no project secrets. */
export function sandboxStart({ name, image }: TensorlakeSettings): string {
  const timeoutSeconds = Duration.toSeconds(MACHINE_LEASE);

  return JSON.stringify({
    name,
    image,
    resources: { cpus: 1, memory_mb: TENSORLAKE_MEMORY_MIB },
    timeout_secs: timeoutSeconds,
    wait: false,
    max_pending_secs: TENSORLAKE_PENDING_SECONDS,
    allow_unauthenticated_access: false,
    exposed_ports: [GUEST_PORT],
    entrypoint: ['/bin/sleep', 'infinity'],
    network: { allow_internet_access: true, allow_out: TENSORLAKE_ALLOWED_HOSTS, deny_out: TENSORLAKE_DENIED_NETWORKS },
  });
}
