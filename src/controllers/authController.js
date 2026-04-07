import * as authService from '../services/authService.js';

/**
 * POST /auth/register — register a new user.
 */
export async function register(request, reply) {
  const result = await authService.register(request.body, request.server.jwt);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.code(201).send(result);
}

/**
 * POST /auth/login — authenticate a user.
 */
export async function login(request, reply) {
  const result = await authService.login(request.body, request.server.jwt);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * POST /auth/refresh — refresh an access token.
 */
export async function refresh(request, reply) {
  const result = await authService.refresh(request.body.refreshToken, request.server.jwt);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * GET /auth/me — get current user profile.
 */
export async function me(request, reply) {
  const result = await authService.getProfile(request.userId);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}

/**
 * PATCH /auth/profile — update user profile.
 */
export async function updateProfile(request, reply) {
  const result = await authService.updateProfile(request.userId, request.body, request.log);
  if (result.error) {
    return reply.code(result.status).send({ error: result.error });
  }
  return reply.send(result);
}
