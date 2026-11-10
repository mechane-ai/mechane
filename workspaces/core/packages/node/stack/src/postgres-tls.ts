import { createPublicKey, randomUUID, X509Certificate } from 'node:crypto';
import { access, chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCommand } from './process.ts';
import type { Environment } from './types.ts';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const AUTHORITY_VALID_DAYS = 3650;
const SERVER_VALID_DAYS = 365;
const DAY_MS = 86_400_000;
const SERVER_MAX_VALIDITY_MS = SERVER_VALID_DAYS * DAY_MS;
type TlsInput = { readonly directory: string; readonly environment: Environment };
export type PostgresTls = { readonly certificateAuthority: string; readonly certificate: string; readonly key: string };

export async function preparePostgresTls(input: TlsInput): Promise<PostgresTls> {
  const directory = join(input.directory, 'postgres-tls');
  const files = tlsFiles(directory);

  const isComplete = await Promise.all([
    access(files.certificateAuthority),
    access(files.certificate),
    access(files.key),
  ]).then(
    () => true,
    () => false,
  );

  if (isComplete) {
    const isValid = await runCommand({
      command: 'openssl',
      args: [
        'verify',
        '-CAfile',
        files.certificateAuthority,
        '-verify_hostname',
        'host.docker.internal',
        files.certificate,
      ],
      environment: input.environment,
    }).then(
      () => true,
      () => false,
    );

    if (isValid && (await isReusableLeaf(files))) {
      return files;
    }
  }

  const temporary = join(input.directory, `postgres-tls-${randomUUID()}`);
  const next = tlsFiles(temporary);
  const authorityKey = join(temporary, 'ca.key');
  const request = join(temporary, 'server.csr');
  const extensions = join(temporary, 'server.ext');
  const existingAuthorityKey = join(directory, 'ca.key');
  const hasAuthority = await exists(files.certificateAuthority);
  const hasAuthorityKey = await exists(existingAuthorityKey);
  const hasServerKey = await exists(files.key);

  if (hasAuthority !== hasAuthorityKey) {
    throw new Error(
      'The local Postgres CA is incomplete; restore its existing certificate and private key before renewal',
    );
  }

  await mkdir(temporary, { mode: PRIVATE_DIRECTORY_MODE });

  async function openssl(args: ReadonlyArray<string>): Promise<void> {
    await runCommand({ command: 'openssl', args, environment: input.environment });
  }

  try {
    if (hasAuthority) {
      await copyFile(files.certificateAuthority, next.certificateAuthority);
      await copyFile(existingAuthorityKey, authorityKey);
    } else {
      await openssl([
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-sha256',
        '-nodes',
        '-days',
        String(AUTHORITY_VALID_DAYS),
        '-keyout',
        authorityKey,
        '-out',
        next.certificateAuthority,
        '-addext',
        'basicConstraints=critical,CA:TRUE',
        '-addext',
        'keyUsage=critical,keyCertSign,cRLSign',
        '-subj',
        '/CN=Mechane local development',
      ]);
    }

    if (hasServerKey) {
      await copyFile(files.key, next.key);
      await openssl(['req', '-new', '-key', next.key, '-out', request, '-subj', '/CN=localhost']);
    } else {
      await openssl([
        'req',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        next.key,
        '-out',
        request,
        '-subj',
        '/CN=localhost',
      ]);
    }

    await writeFile(
      extensions,
      'subjectAltName=DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',
      { mode: PRIVATE_FILE_MODE },
    );
    await openssl([
      'x509',
      '-req',
      '-in',
      request,
      '-CA',
      next.certificateAuthority,
      '-CAkey',
      authorityKey,
      '-CAcreateserial',
      '-out',
      next.certificate,
      '-days',
      String(SERVER_VALID_DAYS),
      '-sha256',
      '-extfile',
      extensions,
    ]);
    await chmod(authorityKey, PRIVATE_FILE_MODE);
    await chmod(next.key, PRIVATE_FILE_MODE);

    if (hasAuthority) {
      if (!hasServerKey) {
        await rename(next.key, files.key);
      }

      await rename(next.certificate, files.certificate);
      await rm(temporary, { recursive: true });

      return files;
    }

    await rm(directory, { recursive: true, force: true });
    await rename(temporary, directory);

    return files;
  } catch (cause) {
    await rm(temporary, { recursive: true, force: true });

    throw new Error('The local Postgres TLS certificates could not be prepared', { cause });
  }
}

async function exists(file: string): Promise<boolean> {
  return await access(file).then(
    () => true,
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return false;
      }

      throw error;
    },
  );
}

async function isReusableLeaf(files: PostgresTls): Promise<boolean> {
  try {
    const certificate = new X509Certificate(await readFile(files.certificate));
    const validityMs = Date.parse(certificate.validTo) - Date.parse(certificate.validFrom);
    const certificateKey = certificate.publicKey.export({ type: 'spki', format: 'der' });
    const privateKey = await readFile(files.key);
    const serverKey = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });

    return validityMs > 0 && validityMs <= SERVER_MAX_VALIDITY_MS && certificateKey.equals(serverKey);
  } catch {
    return false;
  }
}

function tlsFiles(directory: string): PostgresTls {
  return {
    certificateAuthority: join(directory, 'ca.crt'),
    certificate: join(directory, 'server.crt'),
    key: join(directory, 'server.key'),
  };
}
