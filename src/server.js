import 'dotenv/config';
import Fastify from 'fastify';
import mongoose from './plugins/mongoose.js';
import cors from './plugins/cors.js';
import helmet from './plugins/helmet.js';
import rateLimit from './plugins/rateLimit.js';
import auth from './plugins/auth.js';

// ─── Module routes ────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import lyricsRoutes from './modules/lyrics/lyrics.routes.js';
import uploadRoutes from './modules/uploads/uploads.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import spotifyRoutes from './modules/spotify/spotify.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

const envToLogger = {
  development: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  },
  production: { level: 'warn' },
};

async function build() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV] ?? envToLogger.development,
    measureResponseTime: true,
    trustProxy: true,
  });

  // ─── Plugins ──────────────────────────────────────────────────────
  await app.register(helmet);
  await app.register(cors);
  await app.register(rateLimit);
  await app.register(mongoose);
  await app.register(auth);

  // ─── Development request body logging ────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    app.addHook('preHandler', async (request) => {
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        request.log.info({
          method: request.method,
          url: request.url,
          body: request.body,
        }, '📝 Request Body');
      }
    });
  }

  // ─── Routes ───────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(projectRoutes, { prefix: '/projects' });
  await app.register(uploadRoutes, { prefix: '/uploads' });
  await app.register(spotifyRoutes, { prefix: '/spotify' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(adminRoutes, { prefix: '/admin' });

  // Lyrics module handles both /lyrics and /editor prefixes
  // (same domain, backward-compatible URL preservation)
  await app.register(lyricsRoutes, { prefix: '/lyrics' });
  await app.register(lyricsRoutes, { prefix: '/editor' });

  // ─── Health ───────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', version: process.env.npm_package_version }));

  return app;
}

(async () => {
  const app = await build();
  try {
    const port = parseInt(process.env.PORT, 10) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
