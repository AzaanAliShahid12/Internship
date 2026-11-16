import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { initSocket } from './sockets/socket';
import { env } from './config/env';

async function main() {
  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.port, () => {
    console.log(`[server] Gym Management API listening on http://localhost:${env.port}`);
  });
}

main().catch(err => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
