import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';

async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });