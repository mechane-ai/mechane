import type { Server } from 'node:http';

export async function closeHttpServer(server: Server): Promise<void> {
  server.closeAllConnections();

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);

        return;
      }

      resolve();
    });
  });
}
