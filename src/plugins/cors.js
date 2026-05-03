import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

async function corsPlugin(fastify) {
  const origins = process.env.CORS_ORIGIN
    .split(',')
    .map((o) => o.trim());

  await fastify.register(fastifyCors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
  });
}

export default fp(corsPlugin, { name: 'cors' });

