import fp from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';

async function helmetPlugin(fastify) {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false, // Allow OAuth callback popup to postMessage to opener
  });
}

export default fp(helmetPlugin, { name: 'helmet' });
