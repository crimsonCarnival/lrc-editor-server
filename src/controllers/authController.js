import * as authService from '../services/authService.js';

/**
 * POST /auth/register — register a new user.
 */
export async function register(req, res) {
  const deviceId = req.headers['x-device-id'];
  const result = await authService.register(req.body, req.server.jwt, req.ip, deviceId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.code(201).send(result);
}

/**
 * POST /auth/login — authenticate a user.
 */
export async function login(req, res) {
  const deviceId = req.headers['x-device-id'];
  const result = await authService.login(req.body, req.server.jwt, req.ip, deviceId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * POST /auth/refresh — refresh an access token.
 */
export async function refresh(req, res) {
  const deviceId = req.headers['x-device-id'];
  const result = await authService.refresh(req.body.refreshToken, req.server.jwt, req.ip, deviceId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * GET /auth/me — get current user profile.
 */
export async function me(req, res) {
  const deviceId = req.headers['x-device-id'];
  const result = await authService.getProfile(req.userId, req.ip, deviceId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

/**
 * PATCH /auth/profile — update user profile.
 */
export async function updateProfile(req, res) {
  const result = await authService.updateProfile(req.userId, req.body, req.log);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

export async function submitAppeal(req, res) {
  const result = await authService.submitAppeal(req.userId, req.body.appealText);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}

export async function clearUnbanMessage(req, res) {
  const result = await authService.clearUnbanMessage(req.userId);
  if (result.error) {
    return res.code(result.status).send({ error: result.error });
  }
  return res.send(result);
}
