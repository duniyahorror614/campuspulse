import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

function apiDevServerPlugin(): Plugin {
  return {
    name: 'api-dev-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const urlPath = req.url.split('?')[0];

        try {
          if (urlPath === '/api/health') {
            const mod = await server.ssrLoadModule('./api/health.ts');
            return await mod.default(req, res);
          }
          if (urlPath === '/api/extract') {
            const mod = await server.ssrLoadModule('./api/extract.ts');
            return await mod.default(req, res);
          }
          if (urlPath === '/api/summary') {
            const mod = await server.ssrLoadModule('./api/summary.ts');
            return await mod.default(req, res);
          }
        } catch (err) {
          console.error('[API Dev Server Error]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal dev server error' } }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServerPlugin()],
  server: {
    port: 5173,
  },
});
