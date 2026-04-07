import * as settingsService from '../services/settingsService.js';

/**
 * GET /settings — fetch current user's settings.
 */
export async function get(request, reply) {
  const settings = await settingsService.getSettings(request.userId);
  return reply.send(settings);
}

/**
 * PUT /settings — replace all settings.
 */
export async function replace(request, reply) {
  const settings = await settingsService.replaceSettings(request.userId, request.body);
  return reply.send(settings);
}

/**
 * PATCH /settings — merge partial settings updates.
 */
export async function patch(request, reply) {
  const settings = await settingsService.patchSettings(request.userId, request.body);
  return reply.send(settings);
}

/**
 * DELETE /settings — reset settings to defaults.
 */
export async function reset(request, reply) {
  await settingsService.resetSettings(request.userId);
  return reply.code(204).send();
}
