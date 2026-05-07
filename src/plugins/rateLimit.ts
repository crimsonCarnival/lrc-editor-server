import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';

async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => {
      const deviceId = req.headers['x-device-id'];
      if (typeof deviceId === 'string' && deviceId) {
        return `${req.ip}-${deviceId}`;
      }
      return req.ip;
    }
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });