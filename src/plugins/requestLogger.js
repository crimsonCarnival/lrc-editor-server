import fp from 'fastify-plugin';
import { Deque } from '@crimson-carnival/ds-js';
import crypto from 'crypto';

export const requestLog = new Deque();
const MAX_LOGS = 500;

async function requestLoggerPlugin(fastify) {
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Only capture payload for API routes
    if (!request.url.startsWith('/health') && !request.url.startsWith('/admin/logs')) {
      reply.raw._fastifyPayload = payload;
    }
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/health') && !request.url.startsWith('/admin/logs')) {
      let resBody = null;
      try {
        if (typeof reply.raw._fastifyPayload === 'string') {
          resBody = JSON.parse(reply.raw._fastifyPayload);
        }
      } catch {
        resBody = reply.raw._fastifyPayload; // fallback to raw string if not JSON
      }

      requestLog.pushFront({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: Math.round(reply.getResponseTime()),
        ip: request.ip,
        userId: request.userId || 'anonymous',
        reqBody: request.body,
        resBody: resBody,
      });

      if (requestLog.size > MAX_LOGS) {
        requestLog.popBack();
      }
    }
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });
