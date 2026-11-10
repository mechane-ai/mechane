import { createServer } from 'node:net';

export async function freeLocalOrigin(): Promise<URL> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Could not reserve a local service port');
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);

        return;
      }

      resolve();
    });
  });

  const origin = loopbackOriginUrl({ port: address.port });

  return new URL(origin);
}

function loopbackOriginUrl({ port }: { readonly port: number }): string {
  return `http://127.0.0.1:${port}`;
}
