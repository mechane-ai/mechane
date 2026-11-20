import { Pool, types } from 'pg';

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(['postgres:', 'postgresql:']);
const DEFAULT_MAX_CONNECTIONS = 4;
const CONNECTION_TIMEOUT_MILLISECONDS = 10_000;
const IDLE_TIMEOUT_MILLISECONDS = 30_000;

export type DatabaseInput = { readonly databaseUrl: string };

function safeInteger(value: string): number {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new TypeError('Stored integer exceeds the supported range');
  }

  return number;
}

export function openPool({
  databaseUrl,
  maxConnections = DEFAULT_MAX_CONNECTIONS,
}: DatabaseInput & { readonly maxConnections?: number }): Pool {
  try {
    const parsed = new URL(databaseUrl);

    if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
      throw new Error('Unsupported database URL');
    }
  } catch {
    throw new Error('Database configuration is invalid');
  }

  return new Pool({
    connectionString: databaseUrl,
    max: maxConnections,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLISECONDS,
    idleTimeoutMillis: IDLE_TIMEOUT_MILLISECONDS,
    options: '-c timezone=UTC',
    types: {
      getTypeParser: (identifier, format): unknown => {
        if (identifier === types.builtins.TIMESTAMPTZ && format !== 'binary') {
          return (value: string) => new Date(value).toISOString();
        }

        if (identifier === types.builtins.DATE && format !== 'binary') {
          return (value: string) => value;
        }

        if (identifier === types.builtins.INT8 && format !== 'binary') {
          return safeInteger;
        }

        return types.getTypeParser(identifier, format);
      },
    },
  });
}
