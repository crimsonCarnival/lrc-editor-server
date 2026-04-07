import * as settingsController from '../controllers/settingsController.js';
import { settingsBodySchema } from '../schemas/validation.js';

export default async function settingsRoutes(app) {
  app.setErrorHandler((error, request, reply) => {
    if (error.name === 'ValidationError') {
      return reply.code(400).send({ error: 'validation_error' });
    }
    if (error.validation) {
      return reply.code(400).send({ error: 'validation_error' });
    }
    request.log.error(error);
    return reply.code(error.statusCode || 500).send({ error: 'server_error' });
  });

  app.get('/', { preHandler: [app.requireAuth] }, settingsController.get);
  app.put('/', { schema: { body: settingsBodySchema }, preHandler: [app.requireAuth] }, settingsController.replace);
  app.patch('/', { schema: { body: settingsBodySchema }, preHandler: [app.requireAuth] }, settingsController.patch);
  app.delete('/', { preHandler: [app.requireAuth] }, settingsController.reset);
}
