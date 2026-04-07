import fp from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';

async function helmetPlugin(fastify) {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // API server, no HTML responses
  });
}

export default fp(helmetPlugin, { name: 'helmet' });
