import { createApiRouter } from './server/api';
import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import http from 'node:http';
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use('/api', createApiRouter());
async function startServer() {
  const server = http.createServer(app);
  if (process.env.NODE_ENV !== 'production' && !process.argv[1]?.endsWith('server.cjs')) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  server.listen(PORT, '0.0.0.0', () => console.log(`Anima Prompt Sorter: http://localhost:${PORT}`));
}
startServer();
