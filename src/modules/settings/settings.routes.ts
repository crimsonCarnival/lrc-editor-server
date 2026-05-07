import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as settingsController from './settings.controller.js';
import { settingsBodySchema } from './settings.schema.js';

export default async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, request, reply) => {
    const err = error as Error & { validation?: unknown; statusCode?: number };
    if (err.name === 'ValidationError' || err.validation) {
      return reply.code(400).send({ error: 'validation_error' });
    }
    request.log.error(err);
    return reply.code(err.statusCode || 500).send({ error: 'server_error' });
  });

  app.get('/', { preHandler: [app.requireAuth] }, settingsController.get);
  app.put('/', { schema: { body: settingsBodySchema }, preHandler: [app.requireAuth] }, settingsController.replace);
  app.patch('/', { schema: { body: settingsBodySchema }, preHandler: [app.requireAuth] }, settingsController.patch);
  app.delete('/', { preHandler: [app.requireAuth] }, settingsController.reset);
}