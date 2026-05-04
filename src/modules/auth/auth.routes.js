import * as authController from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
} from './auth.schema.js';

export default async function authRoutes(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'validation_error' });
    }
    if (error.statusCode === 429) {
      return reply.code(429).send({ error: 'too_many_requests' });
    }
    request.log.error(error);
    return reply.code(error.statusCode || 500).send({ error: 'server_error' });
  });

  const authRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

  fastify.post('/register', { schema: registerSchema, ...authRateLimit }, authController.register);
  fastify.post('/login', { schema: loginSchema, ...authRateLimit }, authController.login);
  fastify.post('/refresh', { schema: refreshSchema }, authController.refresh);
  fastify.get('/me', { preHandler: [fastify.requireAuth] }, authController.me);
  fastify.patch('/profile', { schema: updateProfileSchema, preHandler: [fastify.requireAuth] }, authController.updateProfile);
  fastify.post('/appeal', { preHandler: [fastify.requireAuth] }, authController.submitAppeal);
  fastify.post('/clear-unban-message', { preHandler: [fastify.requireAuth] }, authController.clearUnbanMessage);
}
