import * as authController from '../controllers/authController.js';

// --- Validation schemas ---
const registerSchema = {
  body: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-zA-Z0-9_-]+$' },
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
    },
    required: ['password'],
    anyOf: [{ required: ['username'] }, { required: ['email'] }],
  },
};

const loginSchema = {
  body: {
    type: 'object',
    properties: {
      identifier: { type: 'string', minLength: 1, maxLength: 254 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
    required: ['identifier', 'password'],
  },
};

const refreshSchema = {
  body: {
    type: 'object',
    properties: {
      refreshToken: { type: 'string', minLength: 1, maxLength: 2048 },
    },
    required: ['refreshToken'],
  },
};

const updateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      avatarUrl: { type: ['string', 'null'], maxLength: 500 },
      avatarPublicId: { type: ['string', 'null'], maxLength: 500 },
    },
    additionalProperties: false,
  },
};

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
}
