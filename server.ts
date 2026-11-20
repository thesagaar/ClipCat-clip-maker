import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServerApp } from './server/app.ts';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const { app, dirs } = createServerApp();

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output missing. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(
      `ClipCat Studio server listening on http://${HOST}:${PORT} (ChatSpike data root ready: ${path.basename(dirs.root)})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start ClipCat server:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
