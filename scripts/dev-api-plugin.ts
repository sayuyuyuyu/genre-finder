import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';

/**
 * `pnpm dev` だけで Cloudflare Pages Functions (`/functions/api/*.ts`) を
 * そのまま叩けるようにする開発用ミドルウェア。
 * 本番は Cloudflare 上で workerd が同じハンドラを実行する。
 */

function loadDevVars(root: string): Record<string, string> {
  const file = resolve(root, '.dev.vars');
  if (!existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function toWebRequest(req: Connect.IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  const method = (req.method ?? 'GET').toUpperCase();
  const init: RequestInit & { duplex?: 'half' } = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (chunks.length > 0) {
      init.body = Buffer.concat(chunks);
      init.duplex = 'half';
    }
  }

  return new Request(new URL(req.url ?? '/', origin), init);
}

function sendWebResponse(res: import('node:http').ServerResponse, response: Response): void {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  void response
    .arrayBuffer()
    .then((buffer) => {
      res.end(Buffer.from(buffer));
    })
    .catch(() => {
      res.statusCode = 500;
      res.end('Failed to read function response');
    });
}

function createApiMiddleware(server: ViteDevServer): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? '/';
    if (!url.startsWith('/api/')) {
      next();
      return;
    }

    const pathname = url.split('?')[0] ?? '/';
    const route = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9-]+$/.test(route)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const mod = (await server.ssrLoadModule(`/functions/api/${route}.ts`)) as {
        onRequest?: (context: Record<string, unknown>) => Promise<Response> | Response;
      };
      if (typeof mod.onRequest !== 'function') {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `functions/api/${route}.ts に onRequest がありません` }));
        return;
      }

      const request = await toWebRequest(req, 'http://localhost');
      const response = await mod.onRequest({
        request,
        env: loadDevVars(server.config.root),
        params: {},
        data: {},
        next: async () => new Response('Not found', { status: 404 }),
        waitUntil: () => {},
        passThroughOnException: () => {},
      });
      sendWebResponse(res, response);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      server.config.logger.error(`[dev-api] /api/${route} でエラー: ${message}`);
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal error (dev)', detail: message }));
    }
  };
}

function devApiPlugin(): Plugin {
  return {
    name: 'genre-finder:dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware(server));
    },
  };
}

export default devApiPlugin;
