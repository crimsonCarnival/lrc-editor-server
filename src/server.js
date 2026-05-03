import 'dotenv/config';
import Fastify from 'fastify';
import mongoose from './plugins/mongoose.js';
import cors from './plugins/cors.js';
import helmet from './plugins/helmet.js';
import rateLimit from './plugins/rateLimit.js';
import auth from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import uploadRoutes from './routes/uploads.js';
import spotifyRoutes from './routes/spotify.js';
import lyricsRoutes from './routes/lyrics.js';
import editorRoutes from './routes/editor.js';
import settingsRoutes from './routes/settings.js';

import adminRoutes from './routes/admin.js';
import requestLogger from './plugins/requestLogger.js';

const envToLogger = {
  development: { 
    level: 'info', 
    transport: { 
      target: 'pino-pretty', 
      options: { 
        translateTime: 'HH:MM:ss Z', 
        ignore: 'pid,hostname',
        singleLine: false
      } 
    } 
  },
  production: { level: 'warn' },
};

async function build() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV] ?? envToLogger.development,
    measureResponseTime: true,
    trustProxy: true,
  });

  // --- Plugins ---
  await app.register(helmet);
  await app.register(cors);
  await app.register(rateLimit);
  await app.register(mongoose);
  await app.register(auth);
  await app.register(requestLogger);

  // --- Request Body Logging (Development) ---
  if (process.env.NODE_ENV === 'development') {
    app.addHook('preHandler', async (request, reply) => {
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        request.log.info({
          method: request.method,
          url: request.url,
          body: request.body,
        }, '📨 Request Body');
      }
    });
  }

  // --- Routes ---
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(projectRoutes, { prefix: '/projects' });
  await app.register(uploadRoutes, { prefix: '/uploads' });
  await app.register(spotifyRoutes, { prefix: '/spotify' });
  await app.register(lyricsRoutes, { prefix: '/lyrics' });
  await app.register(editorRoutes, { prefix: '/editor' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(adminRoutes, { prefix: '/admin' });

  // --- Health ---
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}

const start = async () => {
  const app = await build();
  try {
    const port = parseInt(process.env.PORT, 10) || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
