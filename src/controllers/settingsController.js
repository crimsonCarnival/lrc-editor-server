import * as settingsService from '../services/settingsService.js';

/**
 * GET /settings — fetch current user's settings.
 */
export async function get(req, res) {
  const settings = await settingsService.getSettings(req.userId);
  return res.send(settings);
}

/**
 * PUT /settings — replace all settings.
 */
export async function replace(req, res) {
  const settings = await settingsService.replaceSettings(req.userId, req.body);
  return res.send(settings);
}

/**
 * PATCH /settings — merge partial settings updates.
 */
export async function patch(req, res) {
  const settings = await settingsService.patchSettings(req.userId, req.body);
  return res.send(settings);
}

/**
 * DELETE /settings — reset settings to defaults.
 */
export async function reset(req, res) {
  await settingsService.resetSettings(req.userId);
  return res.code(204).send();
}
